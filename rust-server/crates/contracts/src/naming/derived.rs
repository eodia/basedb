//! `derived.ts` — les noms dérivés (clés, index, contraintes, déclencheurs, séquences, colonnes
//! de lien) et le partage du budget de 63 octets entre leurs composantes (chapitre 01 §9).

use super::MAX_DERIVED_NAME_BYTES;

#[derive(Debug, Clone)]
pub enum Segment<'a> {
    Fixed(&'a str),
    Variable(&'a str),
}

pub const MAX_UNIQUE_COLUMNS_NAMED: usize = 3;

/// `distributeBudget`: water-filling, the remainder to the first components.
pub fn distribute_budget(lengths: &[usize], budget: usize) -> Vec<usize> {
    let n = lengths.len();
    let mut allocated = vec![0usize; n];
    let mut settled = vec![false; n];
    let mut remaining = budget as i64;
    let mut free = n as i64;
    while free > 0 {
        let part = remaining.div_euclid(free);
        let mut settled_this_round = false;
        for i in 0..n {
            if settled[i] {
                continue;
            }
            if (lengths[i] as i64) <= part {
                allocated[i] = lengths[i];
                settled[i] = true;
                remaining -= lengths[i] as i64;
                free -= 1;
                settled_this_round = true;
            }
        }
        if settled_this_round {
            continue;
        }
        let mut rest = remaining - part * free;
        for i in 0..n {
            if settled[i] {
                continue;
            }
            allocated[i] = (part + if rest > 0 { 1 } else { 0 }).max(0) as usize;
            if rest > 0 {
                rest -= 1;
            }
        }
        break;
    }
    allocated
}

fn trim_component(value: &str, max: usize) -> String {
    let cut: String = value.chars().take(max).collect();
    cut.trim_end_matches('_').to_string()
}

/// `assembleDerivedName`.
pub fn assemble_derived_name(segments: &[Segment]) -> String {
    let fixed: usize = segments.iter().map(|s| if let Segment::Fixed(f) = s { f.len() } else { 0 }).sum();
    let variables: Vec<usize> = segments.iter().filter_map(|s| if let Segment::Variable(v) = s { Some(v.len()) } else { None }).collect();
    if fixed + variables.iter().sum::<usize>() <= MAX_DERIVED_NAME_BYTES {
        return segments.iter().map(|s| match s {
            Segment::Fixed(f) | Segment::Variable(f) => *f,
        }).collect();
    }
    let allocation = distribute_budget(&variables, MAX_DERIVED_NAME_BYTES.saturating_sub(fixed));
    let mut index = 0;
    segments
        .iter()
        .map(|s| match s {
            Segment::Fixed(f) => f.to_string(),
            Segment::Variable(v) => {
                let out = trim_component(v, allocation[index]);
                index += 1;
                out
            }
        })
        .collect()
}

use Segment::{Fixed, Variable};

pub fn primary_key_name(table: &str) -> String {
    assemble_derived_name(&[Fixed("pk_"), Variable(table)])
}

pub fn foreign_key_name(table: &str, column: &str) -> String {
    assemble_derived_name(&[Fixed("fk_"), Variable(table), Fixed("__"), Variable(column)])
}

pub fn index_name(table: &str, columns: &[&str]) -> String {
    let mut s = vec![Fixed("ix_"), Variable(table)];
    for c in columns {
        s.push(Fixed("__"));
        s.push(Variable(c));
    }
    assemble_derived_name(&s)
}

pub fn unique_constraint_name(table: &str, columns: &[&str]) -> String {
    let mut s = vec![Fixed("uq_"), Variable(table)];
    for c in columns.iter().take(MAX_UNIQUE_COLUMNS_NAMED) {
        s.push(Fixed("__"));
        s.push(Variable(c));
    }
    if columns.len() > MAX_UNIQUE_COLUMNS_NAMED {
        s.push(Fixed("__etc"));
    }
    assemble_derived_name(&s)
}

pub fn check_constraint_name(table: &str, column: &str, rule: &str) -> String {
    let rule = format!("__{rule}");
    assemble_derived_name(&[Fixed("ck_"), Variable(table), Fixed("__"), Variable(column), Fixed(&rule)])
}

pub fn trigger_name(table: &str, role: &str) -> String {
    let role = format!("__{role}");
    assemble_derived_name(&[Fixed("tg_"), Variable(table), Fixed(&role)])
}

pub fn sequence_name(table: &str, column: &str) -> String {
    assemble_derived_name(&[Variable(table), Fixed("__"), Variable(column), Fixed("_seq")])
}

pub fn link_column_name(target_table: &str) -> String {
    assemble_derived_name(&[Variable(target_table), Fixed("_id")])
}

pub fn link_column_name_from_label(field_slug: &str) -> String {
    assemble_derived_name(&[Variable(field_slug), Fixed("_id")])
}

pub fn multi_link_column_name(target_table: &str) -> String {
    assemble_derived_name(&[Variable(target_table), Fixed("_ids")])
}

pub fn multi_link_column_name_from_label(field_slug: &str) -> String {
    assemble_derived_name(&[Variable(field_slug), Fixed("_ids")])
}

pub fn multi_link_trigger_name(table: &str, column: &str) -> String {
    assemble_derived_name(&[Fixed("tg_"), Variable(table), Fixed("__ml_"), Variable(column)])
}

pub fn multi_link_target_trigger_name(target: &str, source: &str, column: &str) -> String {
    assemble_derived_name(&[Fixed("tg_"), Variable(target), Fixed("__mlt_"), Variable(source), Fixed("_"), Variable(column)])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derived_name_patterns() {
        assert_eq!(primary_key_name("factures"), "pk_factures");
        assert_eq!(foreign_key_name("factures", "clients_id"), "fk_factures__clients_id");
        assert_eq!(index_name("factures", &["clients_id"]), "ix_factures__clients_id");
        assert_eq!(link_column_name("clients"), "clients_id");
        assert_eq!(link_column_name_from_label("client_livre"), "client_livre_id");
        assert_eq!(check_constraint_name("factures", "montant", "range"), "ck_factures__montant__range");
        assert_eq!(trigger_name("factures", "system"), "tg_factures__system");
        assert_eq!(sequence_name("factures", "numero"), "factures__numero_seq");
        assert_eq!(unique_constraint_name("factures", &["numero", "annee"]), "uq_factures__numero__annee");
        assert_eq!(unique_constraint_name("t", &["a", "b", "c", "d"]), "uq_t__a__b__c__etc");
    }

    #[test]
    fn budget_distribution() {
        let name = foreign_key_name("liste_des_contrats_de_prevoyance_collective_sous", "client_livre_id");
        assert_eq!(name, "fk_liste_des_contrats_de_prevoyance_collective__client_livre_id");
        assert_eq!(name.len(), 63);
        assert_eq!(distribute_budget(&[48, 15], 58), vec![43, 15]);
        assert_eq!(distribute_budget(&[50, 50, 50], 7), vec![3, 2, 2]);
    }

    #[test]
    fn no_derived_name_exceeds_63_bytes() {
        let names = ["a", "factures", "liste_des_contrats_de_prevoyance_collective_sous", "x_1_2_3", &"q".repeat(48)];
        for t in names {
            for c1 in names {
                for c2 in names {
                    for n in [
                        primary_key_name(t),
                        foreign_key_name(t, c1),
                        index_name(t, &[c1, c2]),
                        unique_constraint_name(t, &[c1, c2]),
                        check_constraint_name(t, c1, "range"),
                        trigger_name(t, "capture_upd"),
                        sequence_name(t, c1),
                        link_column_name(t),
                        multi_link_target_trigger_name(t, c1, c2),
                    ] {
                        assert!(n.len() <= 63, "{n}");
                    }
                }
            }
        }
    }
}
