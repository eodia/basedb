//! `escapeLabel` (`catalog/labels.ts`): a label shown literally in HTML and in Markdown.

/// Escapes HTML first, then the Markdown punctuation.
pub fn escape_label(label: &str) -> String {
    let mut out = String::with_capacity(label.len());
    for c in label.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            '\\' | '`' | '*' | '_' | '[' | ']' | '(' | ')' | '#' | '!' | '|' | '~' => {
                out.push('\\');
                out.push(c);
            }
            c => out.push(c),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn escapes_html_then_markdown() {
        assert_eq!(escape_label("<script>alert('x')</script>"), "&lt;script&gt;alert\\(&apos;x&apos;\\)&lt;/script&gt;");
        assert_eq!(escape_label("a & b \"c\""), "a &amp; b &quot;c&quot;");
        assert_eq!(escape_label("**gras** _it_ [lien](x) #1 !|~`\\"), "\\*\\*gras\\*\\* \\_it\\_ \\[lien\\]\\(x\\) \\#1 \\!\\|\\~\\`\\\\");
        assert_eq!(escape_label("Clients > 2024"), "Clients &gt; 2024");
        assert_eq!(escape_label("Été"), "Été");
    }
}
