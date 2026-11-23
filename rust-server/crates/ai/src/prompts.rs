//! The closed templates (chapter 12 §2.3), in `prompts/` — copied verbatim from Node when it was
//! ported, they are now the source: edit them there. Nothing a user types reaches them.

use serde_json::Value;
use std::sync::OnceLock;

pub const EXPRESSION_SYSTEM: &str = include_str!("../prompts/EXPRESSION_SYSTEM.txt");
pub const STRUCTURE_SYSTEM: &str = include_str!("../prompts/STRUCTURE_SYSTEM.txt");
pub const STEP_SYSTEM: &str = include_str!("../prompts/STEP_SYSTEM.txt");
pub const FIELD_SYSTEM: &str = include_str!("../prompts/FIELD_SYSTEM.txt");
pub const COPILOT_SYSTEM: &str = include_str!("../prompts/COPILOT_SYSTEM.txt");
pub const TEMPLATE_SYSTEM: &str = include_str!("../prompts/TEMPLATE_SYSTEM.txt");
pub const ATTACHMENTS_RULE: &str = include_str!("../prompts/ATTACHMENTS_RULE.txt");

macro_rules! schema {
    ($name:ident, $file:literal) => {
        pub fn $name() -> &'static Value {
            static S: OnceLock<Value> = OnceLock::new();
            S.get_or_init(|| serde_json::from_str(include_str!($file)).expect("schéma"))
        }
    };
}

schema!(expression_schema, "../prompts/EXPRESSION_SCHEMA.json");
schema!(structure_schema, "../prompts/STRUCTURE_SCHEMA.json");
schema!(field_schema, "../prompts/FIELD_SCHEMA.json");
schema!(copilot_schema, "../prompts/COPILOT_SCHEMA.json");
schema!(template_draft_schema, "../prompts/TEMPLATE_DRAFT_SCHEMA.json");

#[cfg(test)]
mod tests {
    #[test]
    fn templates_are_whole() {
        for s in [super::EXPRESSION_SYSTEM, super::STRUCTURE_SYSTEM, super::FIELD_SYSTEM, super::COPILOT_SYSTEM, super::TEMPLATE_SYSTEM] {
            assert!(!s.contains('\r'), "fins de ligne Windows dans un gabarit");
        }
        assert!(super::ATTACHMENTS_RULE.starts_with("\n\nPIÈCES JOINTES"));
        super::expression_schema();
        super::structure_schema();
        super::field_schema();
        super::copilot_schema();
        super::template_draft_schema();
    }
}
