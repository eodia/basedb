//! `ai/language.ts`: the instructions, with « en français » turned into the reader's language.

fn name_of(language: &str) -> Option<&'static str> {
    Some(match language {
        "en" => "anglais",
        "de" => "allemand",
        "es" => "espagnol",
        "it" => "italien",
        "pt-BR" => "portugais du Brésil",
        "nl" => "néerlandais",
        "pl" => "polonais",
        "cs" => "tchèque",
        "sv" => "suédois",
        "da" => "danois",
        "nb" => "norvégien (bokmål)",
        "fi" => "finnois",
        "ro" => "roumain",
        "hu" => "hongrois",
        "tr" => "turc",
        "uk" => "ukrainien",
        "ja" => "japonais",
        "zh-CN" => "chinois simplifié",
        "ko" => "coréen",
        _ => return None,
    })
}

/// `inLanguage`.
pub fn in_language(system: &str, language: Option<&str>) -> String {
    match language.and_then(name_of) {
        Some(name) => system.replace("en français", &format!("en {name}")),
        None => system.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn turns_french_into_the_reader_s_language() {
        assert_eq!(in_language("Réponds en français, en français.", Some("de")), "Réponds en allemand, en allemand.");
        assert_eq!(in_language("en français", Some("fr")), "en français");
        assert_eq!(in_language("en français", Some("xx")), "en français");
        assert_eq!(in_language("en français", None), "en français");
    }
}
