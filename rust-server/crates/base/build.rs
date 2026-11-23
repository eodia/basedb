//! Embeds the catalog migrations (`packages/catalog-schema/migrations/*.sql` and
//! `sealed.json`) in the binary: the server needs no migrations folder at run time.

use std::path::PathBuf;

fn main() {
    let manifest = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let dir = std::env::var("BASEDB_MIGRATIONS_SOURCE")
        .map(PathBuf::from)
        .unwrap_or_else(|_| manifest.join("..").join("..").join("..").join("packages").join("catalog-schema").join("migrations"));
    assert!(dir.join("sealed.json").is_file(), "migrations du catalogue introuvables ({})", dir.display());
    println!("cargo:rerun-if-changed={}", dir.display());
    println!("cargo:rerun-if-env-changed=BASEDB_MIGRATIONS_SOURCE");

    let mut names: Vec<String> = std::fs::read_dir(&dir)
        .unwrap()
        .filter_map(|e| e.ok())
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .filter(|n| n.ends_with(".sql") || n == "sealed.json")
        .collect();
    names.sort();
    let mut out = String::from("/// The migrations directory's files, as built: (name, text).\npub const EMBEDDED: &[(&str, &str)] = &[\n");
    for name in names {
        let path = dir.join(&name);
        println!("cargo:rerun-if-changed={}", path.display());
        out.push_str(&format!("    ({name:?}, include_str!({:?})),\n", path.display().to_string()));
    }
    out.push_str("];\n");
    let target = PathBuf::from(std::env::var("OUT_DIR").unwrap()).join("embedded_migrations.rs");
    std::fs::write(target, out).unwrap();
}
