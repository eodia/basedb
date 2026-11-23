//! Les documents PDF d'une ligne (`core/src/documents`) : modèles (spec), mise en page et rendu
//! natifs. La mise en page suit `layout.ts` à la lettre ; le fichier est écrit à la main (polices
//! TrueType/CFF sous-ensemblées, polices standard Helvetica/Times, images JPEG/PNG, liens).

pub mod fonts;
pub mod html;
pub mod images;
pub mod intl;
pub mod layout;
pub mod render;
pub mod routes;
pub mod spec;
pub mod templates;
pub mod writer;
