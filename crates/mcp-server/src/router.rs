use std::{
    future::Future,
    pin::Pin,
    task::{Context, Poll},
    time::Duration,
};
use tokio::time::sleep;

use mcp_core::{
    handler::ToolError,
    protocol::{
        JsonRpcRequest, JsonRpcResponse, ServerCapabilities, InitializeResult, Implementation,
        PromptsCapability, ResourcesCapability, ToolsCapability, ListToolsResult, CallToolResult,
    },
    content::Content,
};
use tower_service::Service;
use serde_json::Value;

use crate::{RouterError, BoxError};

/// Builder for configuring and constructing capabilities
pub struct CapabilitiesBuilder {
    tools: Option<ToolsCapability>,
    prompts: Option<PromptsCapability>,
    resources: Option<ResourcesCapability>,
}

impl CapabilitiesBuilder {
    pub fn new() -> Self {
        Self {
            tools: None,
            prompts: None,
            resources: None,
        }
    }

    /// Add multiple tools to the router
    pub fn with_tools(mut self, list_changed: bool) -> Self
    {
        self.tools = Some(ToolsCapability {
            list_changed: Some(list_changed),
        });
        self
    }

    /// Enable prompts capability
    pub fn with_prompts(mut self, list_changed: bool) -> Self {
        self.prompts = Some(PromptsCapability {
            list_changed: Some(list_changed),
        });
        self
    }

    /// Enable resources capability
    pub fn with_resources(mut self, subscribe: bool, list_changed: bool) -> Self {
        self.resources = Some(ResourcesCapability {
            subscribe: Some(subscribe),
            list_changed: Some(list_changed),
        });
        self
    }

    /// Build the router with automatic capability inference
    pub fn build(self) -> ServerCapabilities {
        // Create capabilities based on what's configured
        ServerCapabilities {
            tools: self.tools,
            prompts: self.prompts,
            resources: self.resources,
        }
    }
}

pub trait Router: Send + Sync + 'static {
    fn capabilities(&self) -> ServerCapabilities;
    fn list_tools(&self) -> Vec<mcp_core::tool::Tool>;
    fn call_tool(&self, tool_name: &str, arguments: Value) -> Pin<Box<dyn Future<Output = Result<Value, ToolError>> + Send + 'static>>;

    // Helper method to create base response
    fn create_response(&self, id: Option<u64>) -> JsonRpcResponse {
        JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            id,
            result: None,
            error: None,
        }
    }

    fn handle_initialize(&self, req: JsonRpcRequest) -> impl Future<Output = Result<JsonRpcResponse, RouterError>> + Send {
        async move {
            let result = InitializeResult {
                protocol_version: "2024-11-05".to_string(),
                capabilities: self.capabilities().clone(),
                server_info: Implementation {
                    name: "mcp-server".to_string(),
                    version: env!("CARGO_PKG_VERSION").to_string(),
                },
            };

            let mut response = self.create_response(req.id);
            response.result = Some(serde_json::to_value(result)
                .map_err(|e| RouterError::Internal(format!("JSON serialization error: {}", e)))?);

            Ok(response)
        }
    }

    fn handle_tools_list(&self, req: JsonRpcRequest) -> impl Future<Output = Result<JsonRpcResponse, RouterError>> + Send {
        async move {
            let tools = self.list_tools();

            let result = ListToolsResult { tools };
            let mut response = self.create_response(req.id);
            response.result = Some(serde_json::to_value(result)
                .map_err(|e| RouterError::Internal(format!("JSON serialization error: {}", e)))?);

            Ok(response)
        }
    }

    fn handle_tools_call(&self, req: JsonRpcRequest) -> impl Future<Output = Result<JsonRpcResponse, RouterError>> + Send {
        async move {
            let params = req.params.ok_or_else(|| RouterError::InvalidParams("Missing parameters".into()))?;

            let name = params.get("name")
                .and_then(Value::as_str)
                .ok_or_else(|| RouterError::InvalidParams("Missing tool name".into()))?;

            let arguments = params.get("arguments")
                .cloned()
                .unwrap_or(Value::Null);

            let result = match self.call_tool(name, arguments).await {
                Ok(result) => CallToolResult {
                    content: vec![Content::text(result.to_string())],
                    is_error: false,
                },
                Err(err) => CallToolResult {
                    content: vec![Content::text(err.to_string())],
                    is_error: true,
                }
            };

            let mut response = self.create_response(req.id);
            response.result = Some(serde_json::to_value(result)
                .map_err(|e| RouterError::Internal(format!("JSON serialization error: {}", e)))?);

            Ok(response)
        }
    }
}

// A wrapper type to implement the Service trait locally
pub struct RouterService<T>(pub T);

impl<T> Service<JsonRpcRequest> for RouterService<T>
where
    T: Router + Clone + Send + Sync + 'static,
{
    type Response = JsonRpcResponse;
    type Error = BoxError;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn poll_ready(&mut self, _cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        Poll::Ready(Ok(()))
    }

    fn call(&mut self, req: JsonRpcRequest) -> Self::Future {
        let this = self.0.clone();

        Box::pin(async move {
            let result = match req.method.as_str() {
                "slow" => {
                    sleep(Duration::from_secs(60)).await;
                    let mut response = this.create_response(req.id);
                    response.result = Some(Value::String("This should never be seen".to_string()));
                    Ok(response)
                },
                "initialize" => this.handle_initialize(req).await,
                "tools/list" => this.handle_tools_list(req).await,
                "tools/call" => this.handle_tools_call(req).await,
                _ => {
                    let mut response = this.create_response(req.id);
                    response.error = Some(RouterError::MethodNotFound(req.method).into());
                    Ok(response)
                }
            };

            result.map_err(BoxError::from)
        })
    }
}
