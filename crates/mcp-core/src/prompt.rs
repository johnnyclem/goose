use crate::handler::PromptError;
use base64::engine::{general_purpose::STANDARD as BASE64_STANDARD, Engine};
use serde::{Deserialize, Serialize};

/// A prompt that can be used to generate text from a model
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Prompt {
    /// The name of the prompt
    pub name: String,
    /// A description of what the prompt does
    pub description: String,
    /// The arguments that can be passed to customize the prompt
    pub arguments: Vec<PromptArgument>,
}

impl Prompt {
    /// Create a new prompt with the given name, description and arguments
    pub fn new<N, D>(name: N, description: D, arguments: Vec<PromptArgument>) -> Self
    where
        N: Into<String>,
        D: Into<String>,
    {
        Prompt {
            name: name.into(),
            description: description.into(),
            arguments,
        }
    }
}

/// Represents a prompt argument that can be passed to customize the prompt
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptArgument {
    /// The name of the argument
    pub name: String,
    /// A description of what the argument is used for
    pub description: String,
    /// Whether this argument is required
    pub required: bool,
}

/// Represents the role of a message sender in a prompt conversation
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PromptMessageRole {
    User,
    Assistant,
}

/// Content types that can be included in prompt messages
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum PromptMessageContent {
    /// Plain text content
    Text { text: String },
    /// Image content with base64-encoded data
    Image {
        data: String,
        #[serde(rename = "mimeType")]
        mime_type: String,
    },
    /// Embedded server-side resource
    Resource { resource: ResourceContent },
}

/// Content of an embedded resource in a message
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ResourceContent {
    pub uri: String,
    #[serde(rename = "mimeType")]
    pub mime_type: String,
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub blob: Option<String>,
}

/// A message in a prompt conversation
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PromptMessage {
    /// The role of the message sender
    pub role: PromptMessageRole,
    /// The content of the message
    pub content: PromptMessageContent,
}

impl PromptMessage {
    /// Create a new text message with the given role and text content
    pub fn new_text<S: Into<String>>(role: PromptMessageRole, text: S) -> Self {
        Self {
            role,
            content: PromptMessageContent::Text { text: text.into() },
        }
    }

    pub fn new_image<S: Into<String>>(
        role: PromptMessageRole,
        data: S,
        mime_type: S,
    ) -> Result<Self, PromptError> {
        let data = data.into();
        let mime_type = mime_type.into();

        // Validate base64 data
        BASE64_STANDARD.decode(&data).map_err(|_| {
            PromptError::InvalidParameters("Image data must be valid base64".to_string())
        })?;

        // Validate mime type
        if !mime_type.starts_with("image/") {
            return Err(PromptError::InvalidParameters(
                "MIME type must be a valid image type (e.g. image/jpeg)".to_string(),
            ));
        }

        Ok(Self {
            role,
            content: PromptMessageContent::Image { data, mime_type },
        })
    }

    /// Create a new resource message
    pub fn new_resource(
        role: PromptMessageRole,
        uri: String,
        mime_type: String,
        text: Option<String>,
        blob: Option<String>,
    ) -> Self {
        Self {
            role,
            content: PromptMessageContent::Resource {
                resource: ResourceContent {
                    uri,
                    mime_type,
                    text,
                    blob,
                },
            },
        }
    }
}

/// A template for a prompt
#[derive(Debug, Serialize, Deserialize)]
pub struct PromptTemplate {
    pub id: String,
    pub template: String,
    pub arguments: Vec<PromptArgumentTemplate>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PromptArgumentTemplate {
    pub name: String,
    pub description: String,
    pub required: bool,
}
