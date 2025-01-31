use anyhow::{Error, Result};
use async_trait::async_trait;
use reqwest::Client;
use serde_json::{json, Value};
use std::time::Duration;

use super::base::{ConfigKey, Provider, ProviderMetadata, ProviderUsage, Usage};
use super::errors::ProviderError;
use super::utils::{emit_debug_trace, get_model, handle_response_openai_compat};
use crate::message::{Message, MessageContent};
use crate::model::ModelConfig;
use crate::providers::formats::openai::{create_request, get_usage, response_to_message};
use mcp_core::tool::{Tool, ToolCall};

pub const OPENROUTER_DEFAULT_MODEL: &str = "anthropic/claude-3.5-sonnet";
pub const OPENROUTER_MODEL_PREFIX_ANTHROPIC: &str = "anthropic";
pub const OPENROUTER_MODEL_PREFIX_DEEPSEEK: &str = "deepseek-r1";

// OpenRouter can run many models, we suggest the default
pub const OPENROUTER_KNOWN_MODELS: &[&str] = &[OPENROUTER_DEFAULT_MODEL];
pub const OPENROUTER_DOC_URL: &str = "https://openrouter.ai/models";

#[derive(serde::Serialize)]
pub struct OpenRouterProvider {
    #[serde(skip)]
    client: Client,
    host: String,
    api_key: String,
    model: ModelConfig,
}

impl Default for OpenRouterProvider {
    fn default() -> Self {
        let model = ModelConfig::new(OpenRouterProvider::metadata().default_model);
        OpenRouterProvider::from_env(model).expect("Failed to initialize OpenRouter provider")
    }
}

impl OpenRouterProvider {
    pub fn from_env(model: ModelConfig) -> Result<Self> {
        let config = crate::config::Config::global();
        let api_key: String = config.get_secret("OPENROUTER_API_KEY")?;
        let host: String = config
            .get("OPENROUTER_HOST")
            .unwrap_or_else(|_| "https://openrouter.ai".to_string());

        let client = Client::builder()
            .timeout(Duration::from_secs(600))
            .build()?;

        Ok(Self {
            client,
            host,
            api_key,
            model,
        })
    }

    async fn post(&self, payload: Value) -> Result<Value, ProviderError> {
        let url = format!(
            "{}/api/v1/chat/completions",
            self.host.trim_end_matches('/')
        );

        let response = self
            .client
            .post(&url)
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("HTTP-Referer", "https://github.com/block/goose")
            .header("X-Title", "Goose")
            .json(&payload)
            .send()
            .await?;

        handle_response_openai_compat(response).await
    }
}

/// Update the request when using anthropic model.
/// For older anthropic models we enabled prompt caching, but newer ones (Claude-3) don't support it.
fn update_request_for_anthropic(original_payload: &Value) -> Value {
    let mut payload = original_payload.clone();

    // Only add cache control for non-Claude-3 models
    if !payload
        .get("model")
        .and_then(|m| m.as_str())
        .unwrap_or("")
        .contains("claude-3")
    {
        if let Some(messages_spec) = payload
            .as_object_mut()
            .and_then(|obj| obj.get_mut("messages"))
            .and_then(|messages| messages.as_array_mut())
        {}
    }
    payload
}

fn update_request_for_deepseek(original_payload: &Value) -> Value {
    let mut payload = original_payload.clone();

    // Extract tools before removing them from the payload
    let tools = payload.get("tools").cloned();

    if let Some(messages_spec) = payload
        .as_object_mut()
        .and_then(|obj| obj.get_mut("messages"))
        .and_then(|messages| messages.as_array_mut())
    {}

    // Remove any tools/function calling capabilities from the request
    if let Some(obj) = payload.as_object_mut() {
        obj.remove("tools");
        obj.remove("tool_choice");
    }

    payload
}

fn create_request_based_on_model(
    model_config: &ModelConfig,
    system: &str,
    messages: &[Message],
    tools: &[Tool],
) -> anyhow::Result<Value, Error> {
    let mut payload = create_request(
        model_config,
        system,
        messages,
        tools,
        &super::utils::ImageFormat::OpenAi,
    )?;

    // Check for Anthropic models
    if model_config
        .model_name
        .starts_with(OPENROUTER_MODEL_PREFIX_ANTHROPIC)
    {
        payload = update_request_for_anthropic(&payload);
    }

    // Check for DeepSeek models
    if model_config
        .model_name
        .contains(OPENROUTER_MODEL_PREFIX_DEEPSEEK)
    {
        payload = update_request_for_deepseek(&payload);
    }

    Ok(payload)
}

#[async_trait]
impl Provider for OpenRouterProvider {
    fn metadata() -> ProviderMetadata {
        ProviderMetadata::new(
            "openrouter",
            "OpenRouter",
            "Router for many model providers",
            OPENROUTER_DEFAULT_MODEL,
            OPENROUTER_KNOWN_MODELS
                .iter()
                .map(|&s| s.to_string())
                .collect(),
            OPENROUTER_DOC_URL,
            vec![
                ConfigKey::new("OPENROUTER_API_KEY", true, true, None),
                ConfigKey::new(
                    "OPENROUTER_HOST",
                    false,
                    false,
                    Some("https://openrouter.ai"),
                ),
            ],
        )
    }

    fn get_model_config(&self) -> ModelConfig {
        self.model.clone()
    }

    #[tracing::instrument(
        skip(self, system, messages, tools),
        fields(model_config, input, output, input_tokens, output_tokens, total_tokens)
    )]
    async fn complete(
        &self,
        system: &str,
        messages: &[Message],
        tools: &[Tool],
    ) -> Result<(Message, ProviderUsage), ProviderError> {
        // Create the base payload
        let payload = create_request_based_on_model(&self.model, system, messages, tools)?;

        // Make request
        let response = self.post(payload.clone()).await?;

        // Debug log the response structure
        println!(
            "OpenRouter response: {}",
            serde_json::to_string_pretty(&response).unwrap_or_default()
        );

        // First try to parse as OpenAI format
        let mut message = response_to_message(response.clone())?;

        // If no tool calls were found in OpenAI format, check for XML format
        if !message.is_tool_call() {
            if let Some(MessageContent::Text(text_content)) = message.content.first() {
                let content = &text_content.text;
                if let Some(calls_start) = content.find("<function_calls>") {
                    if let Some(calls_end) = content.find("</function_calls>") {
                        let calls_text = &content[calls_start..=calls_end + 15];

                        // Extract the invoke block
                        if let Some(invoke_start) = calls_text.find("<invoke") {
                            if let Some(invoke_end) = calls_text[invoke_start..].find("</invoke>") {
                                let invoke_text =
                                    &calls_text[invoke_start..invoke_start + invoke_end + 9];

                                // Parse name and parameters
                                if let Some(name_start) = invoke_text.find("name=\"") {
                                    if let Some(name_end) = invoke_text[name_start + 6..].find("\"")
                                    {
                                        let name = invoke_text
                                            [name_start + 6..name_start + 6 + name_end]
                                            .to_string();

                                        // Build parameters map
                                        let mut parameters = serde_json::Map::new();
                                        let mut param_pos = 0;
                                        while let Some(param_start) =
                                            invoke_text[param_pos..].find("<parameter")
                                        {
                                            if let Some(param_end) = invoke_text
                                                [param_pos + param_start..]
                                                .find("</parameter>")
                                            {
                                                let param_text = &invoke_text[param_pos
                                                    + param_start
                                                    ..param_pos + param_start + param_end + 11];

                                                if let Some(param_name_start) =
                                                    param_text.find("name=\"")
                                                {
                                                    if let Some(param_name_end) = param_text
                                                        [param_name_start + 6..]
                                                        .find("\"")
                                                    {
                                                        let param_name = &param_text
                                                            [param_name_start + 6
                                                                ..param_name_start
                                                                    + 6
                                                                    + param_name_end];

                                                        if let Some(value_start) =
                                                            param_text.find(">")
                                                        {
                                                            if let Some(value_end) = param_text
                                                                [value_start + 1..]
                                                                .find("<")
                                                            {
                                                                let param_value = &param_text
                                                                    [value_start + 1
                                                                        ..value_start
                                                                            + 1
                                                                            + value_end];
                                                                parameters.insert(
                                                                    param_name.to_string(),
                                                                    Value::String(
                                                                        param_value.to_string(),
                                                                    ),
                                                                );
                                                            }
                                                        }
                                                    }
                                                }
                                                param_pos += param_start + param_end + 11;
                                            } else {
                                                break;
                                            }
                                        }

                                        // Create tool request
                                        message.content.clear();
                                        message.content.push(MessageContent::tool_request(
                                            "1",
                                            Ok(ToolCall {
                                                name,
                                                arguments: serde_json::to_value(parameters)
                                                    .unwrap_or_default(),
                                            }),
                                        ));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        let usage = match get_usage(&response) {
            Ok(usage) => usage,
            Err(ProviderError::UsageError(e)) => {
                tracing::warn!("Failed to get usage data: {}", e);
                Usage::default()
            }
            Err(e) => return Err(e),
        };
        let model = get_model(&response);
        emit_debug_trace(self, &payload, &response, &usage);
        Ok((message, ProviderUsage::new(model, usage)))
    }
}
