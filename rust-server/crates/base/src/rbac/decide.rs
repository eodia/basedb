//! Le point unique de décision des droits — chapitre 05 §3.2 et §6.1, tel `rbac/decide.ts`.
//!
//! Il ne rend PAS un booléen : « oui, mais sur ces colonnes » ne se reconstruit pas
//! ailleurs sans dupliquer la logique. Il ne lit jamais la base pendant une décision : il
//! travaille sur un instantané préparé en amont ([`super::loader`]).

use super::rows::personalize;
use crate::tx::{RequestContext, Surface};
use indexmap::IndexSet;
use std::collections::HashMap;

/// The seven verbs of v1 (§1.3). No other exists.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Action {
    Read,
    Create,
    Update,
    Delete,
    ManageSchema,
    ManagePermissions,
    ManageTokens,
}

pub const ACTIONS: [Action; 7] =
    [Action::Read, Action::Create, Action::Update, Action::Delete, Action::ManageSchema, Action::ManagePermissions, Action::ManageTokens];

impl Action {
    pub fn as_str(self) -> &'static str {
        match self {
            Action::Read => "read",
            Action::Create => "create",
            Action::Update => "update",
            Action::Delete => "delete",
            Action::ManageSchema => "manage_schema",
            Action::ManagePermissions => "manage_permissions",
            Action::ManageTokens => "manage_tokens",
        }
    }
    pub fn parse(s: &str) -> Option<Action> {
        ACTIONS.into_iter().find(|a| a.as_str() == s)
    }
}

/// `instance ⊃ tenant ⊃ project ⊃ base ⊃ {application, table} ⊃ field` (§1.4, §15).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScopeKind {
    Tenant,
    Project,
    Base,
    Application,
    Table,
}

impl ScopeKind {
    pub fn parse(s: &str) -> Option<ScopeKind> {
        match s {
            "tenant" => Some(ScopeKind::Tenant),
            "project" => Some(ScopeKind::Project),
            "base" => Some(ScopeKind::Base),
            "application" => Some(ScopeKind::Application),
            "table" => Some(ScopeKind::Table),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Verdict {
    Allowed,
    Invisible,
    Forbidden,
}

/// The tenant scope names no object: it holds for the role's tenant.
pub const TENANT_SCOPE: &str = "*";

#[derive(Debug, Clone, PartialEq)]
pub struct Permission {
    pub action: Action,
    pub scope_kind: ScopeKind,
    pub scope_id: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FieldMode {
    Hidden,
    ReadOnly,
}

/// A field restriction: it grants nothing, it only subtracts (§4).
#[derive(Debug, Clone, PartialEq)]
pub struct FieldRestriction {
    pub field_id: String,
    pub mode: FieldMode,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct Role {
    pub id: String,
    pub permissions: Vec<Permission>,
    pub field_restrictions: Vec<FieldRestriction>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TargetKind {
    Table,
    Base,
    Project,
    Tenant,
}

/// The target of a decision, by its CATALOG KEY, never by its name.
#[derive(Debug, Clone, PartialEq)]
pub struct Target {
    pub kind: TargetKind,
    pub id: String,
    /// Tenant REF; `None` for an instance object.
    pub tenant_id: Option<String>,
    pub project_id: Option<String>,
    pub base_id: Option<String>,
    pub application_ids: Vec<String>,
    pub field_ids: Vec<String>,
    pub agent_hidden_field_ids: Vec<String>,
    pub agents_excluded: bool,
    pub computed_field_ids: Vec<String>,
    /// role id → compiled template (`rows.rs`); empty: no rule.
    pub row_rules: HashMap<String, String>,
}

impl Target {
    pub fn new(kind: TargetKind, id: impl Into<String>, tenant_id: Option<String>) -> Target {
        Target {
            kind,
            id: id.into(),
            tenant_id,
            project_id: None,
            base_id: None,
            application_ids: vec![],
            field_ids: vec![],
            agent_hidden_field_ids: vec![],
            agents_excluded: false,
            computed_field_ids: vec![],
            row_rules: HashMap::new(),
        }
    }
}

/// Snapshot of an actor's grants (`ActorGrants`).
#[derive(Debug, Clone, PartialEq, Default)]
pub struct ActorGrants {
    pub is_instance_admin: bool,
    pub roles: Vec<Role>,
    /// For a token: `Some(Some(base))` bound to one base, `Some(None)` the whole tenant.
    pub token_base_id: Option<Option<String>>,
    pub token_base_ids: Option<Vec<String>>,
    pub token_allowed_surfaces: Option<Vec<Surface>>,
    pub token_role: Option<Role>,
}

pub type FieldSet = IndexSet<String>;

#[derive(Debug, Clone, PartialEq)]
pub struct Decision {
    pub verdict: Verdict,
    pub readable_fields: FieldSet,
    pub writable_fields: FieldSet,
    pub clearable_fields: FieldSet,
    /// SQL over the placeholder alias of `rows.rs`; `TRUE` without a row rule.
    pub row_predicate: String,
    /// Stable code for the log, NEVER for the client.
    pub reason: &'static str,
}

/// The five system columns, always readable once `read` is granted (A18).
pub const SYSTEM_COLUMNS: [&str; 5] = ["_id", "_created_at", "_updated_at", "_created_by", "_updated_by"];

fn deny(verdict: Verdict, reason: &'static str) -> Decision {
    Decision {
        verdict,
        readable_fields: FieldSet::new(),
        writable_fields: FieldSet::new(),
        clearable_fields: FieldSet::new(),
        row_predicate: "FALSE".into(),
        reason,
    }
}

fn scope_covers(p: &Permission, t: &Target) -> bool {
    match p.scope_kind {
        ScopeKind::Tenant => t.tenant_id.as_ref().is_some_and(|tenant| p.scope_id == TENANT_SCOPE || &p.scope_id == tenant),
        ScopeKind::Project => Some(&p.scope_id) == (if t.kind == TargetKind::Project { Some(&t.id) } else { t.project_id.as_ref() }),
        ScopeKind::Base => Some(&p.scope_id) == (if t.kind == TargetKind::Base { Some(&t.id) } else { t.base_id.as_ref() }),
        ScopeKind::Table => t.kind == TargetKind::Table && p.scope_id == t.id,
        ScopeKind::Application => t.application_ids.contains(&p.scope_id),
    }
}

fn reach_capabilities(role: &Role, t: &Target) -> Vec<Action> {
    let mut out = Vec::new();
    for p in &role.permissions {
        if scope_covers(p, t) && !out.contains(&p.action) {
            out.push(p.action);
        }
    }
    out
}

struct Reach {
    capabilities: Vec<Action>,
    readable: FieldSet,
    writable: FieldSet,
}

fn mask(all_fields: &[String], reading: &[(&Role, bool)], everything: bool) -> (FieldSet, FieldSet) {
    let mut readable = FieldSet::new();
    let mut writable = FieldSet::new();
    for field in all_fields {
        let mut level = if everything { 2 } else { 0 };
        for (role, writes) in reading {
            let rule = role.field_restrictions.iter().find(|f| &f.field_id == field).map(|f| f.mode);
            let own = match rule {
                Some(FieldMode::Hidden) => 0,
                Some(FieldMode::ReadOnly) => 1,
                None if *writes => 2,
                None => 1,
            };
            level = level.max(own);
        }
        if level >= 1 {
            readable.insert(field.clone());
        }
        if level == 2 {
            writable.insert(field.clone());
        }
    }
    for c in SYSTEM_COLUMNS {
        readable.insert(c.to_string());
    }
    (readable, writable)
}

fn reach(is_instance_admin: bool, roles: &[Role], t: &Target, all_fields: &[String]) -> Option<Reach> {
    if is_instance_admin {
        let (readable, writable) = mask(all_fields, &[], true);
        return Some(Reach { capabilities: ACTIONS.to_vec(), readable, writable });
    }
    let mut capabilities = Vec::new();
    let mut reading = Vec::new();
    for role in roles {
        let held = reach_capabilities(role, t);
        for a in &held {
            if !capabilities.contains(a) {
                capabilities.push(*a);
            }
        }
        if held.contains(&Action::Read) {
            reading.push((role, held.contains(&Action::Create) || held.contains(&Action::Update)));
        }
    }
    if !capabilities.contains(&Action::Read) {
        return None;
    }
    let (readable, writable) = mask(all_fields, &reading, false);
    Some(Reach { capabilities, readable, writable })
}

/// `decide`: the nine steps of §3.2, in this exact order.
pub fn decide(ctx: &RequestContext, grants: &ActorGrants, action: Action, target: &Target) -> Decision {
    // 1. No actor.
    if ctx.actor.id.is_empty() {
        return deny(Verdict::Forbidden, "AUTHENTICATION_REQUIRED");
    }
    // 2. Partitioning, instance administrators included.
    if target.tenant_id.as_ref().is_some_and(|t| t != &ctx.tenant_id) {
        return deny(Verdict::Invisible, "TENANT_MISMATCH");
    }
    if let Some(surfaces) = &grants.token_allowed_surfaces {
        if !surfaces.contains(&ctx.surface) {
            return deny(Verdict::Forbidden, "TOKEN_INVALID");
        }
    }
    // 4. Token scope.
    if let Some(Some(token_base)) = &grants.token_base_id {
        let target_base = if target.kind == TargetKind::Base { Some(&target.id) } else { target.base_id.as_ref() };
        if Some(token_base) != target_base
            && target_base.is_none_or(|b| !grants.token_base_ids.as_ref().is_some_and(|ids| ids.contains(b)))
        {
            return deny(Verdict::Invisible, "TOKEN_SCOPE");
        }
    }
    if ctx.surface == Surface::Mcp && target.agents_excluded {
        return deny(Verdict::Invisible, "MCP_DISABLED");
    }
    let withheld: &[String] = if ctx.surface == Surface::Mcp { &target.agent_hidden_field_ids } else { &[] };
    let all_fields: Vec<String> = target.field_ids.iter().filter(|f| !withheld.contains(f)).cloned().collect();

    let Some(own) = reach(grants.is_instance_admin, &grants.roles, target, &all_fields) else {
        return deny(Verdict::Invisible, "NO_READ");
    };
    let Reach { mut capabilities, mut readable, mut writable } = own;
    let mut reason = if grants.is_instance_admin { "INSTANCE_ADMIN" } else { "GRANTED" };
    if !target.computed_field_ids.is_empty() {
        writable.retain(|f| !target.computed_field_ids.contains(f));
    }
    if let Some(token_role) = &grants.token_role {
        let Some(bound) = reach(false, std::slice::from_ref(token_role), target, &all_fields) else {
            return deny(Verdict::Invisible, "NO_READ");
        };
        capabilities.retain(|a| bound.capabilities.contains(a));
        readable.retain(|f| bound.readable.contains(f));
        writable.retain(|f| bound.writable.contains(f));
        reason = "TOKEN_BOUND";
    }
    let business = readable.iter().filter(|f| !SYSTEM_COLUMNS.contains(&f.as_str())).count();
    if !target.field_ids.is_empty() && business == 0 {
        return deny(Verdict::Invisible, "EMPTY_MASK");
    }
    if !capabilities.contains(&action) {
        let token_refused = grants.token_role.as_ref().is_some_and(|r| !reach_capabilities(r, target).contains(&action));
        return deny(Verdict::Forbidden, if token_refused { "TOKEN_ACTION_NOT_GRANTED" } else { "ACTION_NOT_GRANTED" });
    }
    let clearable: FieldSet = readable.iter().filter(|f| !writable.contains(*f)).cloned().collect();
    Decision {
        verdict: Verdict::Allowed,
        readable_fields: readable,
        writable_fields: writable,
        clearable_fields: clearable,
        row_predicate: rows_of(ctx, grants, target),
        reason,
    }
}

/// The rows a table's reader reaches (§16): the union over the reading roles.
fn rows_of(ctx: &RequestContext, grants: &ActorGrants, target: &Target) -> String {
    let rules = &target.row_rules;
    if grants.is_instance_admin || target.kind != TargetKind::Table || rules.is_empty() {
        return "TRUE".into();
    }
    let mut parts: Vec<&String> = Vec::new();
    for role in &grants.roles {
        let held = reach_capabilities(role, target);
        if !held.contains(&Action::Read) {
            continue;
        }
        if held.contains(&Action::ManageSchema) {
            return "TRUE".into();
        }
        let Some(rule) = rules.get(&role.id) else { return "TRUE".into() };
        if !parts.contains(&rule) {
            parts.push(rule);
        }
    }
    if parts.is_empty() {
        return "FALSE".into();
    }
    let combined = if parts.len() == 1 { parts[0].clone() } else { parts.iter().map(|p| format!("({p})")).collect::<Vec<_>>().join(" OR ") };
    personalize(&combined, &ctx.actor.id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tx::{Actor, ActorKind};

    const TENANT: &str = "t4z56fq";
    const OTHER_TENANT: &str = "t9k2mnp";
    const BASE: &str = "base-1";
    const TABLE: &str = "table-1";
    const FIELDS: [&str; 3] = ["f-numero", "f-montant", "f-salaire"];

    fn context() -> RequestContext {
        RequestContext::new("018f3c2a-0000-7000-8000-000000000001", Actor::user("u-1"), TENANT, Surface::Rest)
    }
    fn with_surface(mut c: RequestContext, s: Surface) -> RequestContext {
        c.surface = s;
        c
    }
    fn token_ctx() -> RequestContext {
        let mut c = context();
        c.actor = Actor { kind: ActorKind::Token, id: "u-1".into(), token_id: Some("tok-1".into()) };
        c.surface = Surface::Mcp;
        c
    }
    fn target() -> Target {
        let mut t = Target::new(TargetKind::Table, TABLE, Some(TENANT.into()));
        t.base_id = Some(BASE.into());
        t.field_ids = FIELDS.iter().map(|s| s.to_string()).collect();
        t
    }
    fn perm(action: Action, kind: ScopeKind, id: &str) -> Permission {
        Permission { action, scope_kind: kind, scope_id: id.into() }
    }
    fn role(id: &str, actions: &[Action], restrictions: Vec<FieldRestriction>) -> Role {
        Role { id: id.into(), permissions: actions.iter().map(|a| perm(*a, ScopeKind::Base, BASE)).collect(), field_restrictions: restrictions }
    }
    fn grants_for(actions: &[Action]) -> ActorGrants {
        ActorGrants { roles: vec![role("r-1", actions, vec![])], ..Default::default() }
    }
    fn admin() -> ActorGrants {
        ActorGrants { is_instance_admin: true, ..Default::default() }
    }
    fn hidden(f: &str) -> FieldRestriction {
        FieldRestriction { field_id: f.into(), mode: FieldMode::Hidden }
    }
    fn read_only(f: &str) -> FieldRestriction {
        FieldRestriction { field_id: f.into(), mode: FieldMode::ReadOnly }
    }
    use Action::*;

    #[test]
    fn step2_partitioning_first_admins_included() {
        let mut foreign = target();
        foreign.tenant_id = Some(OTHER_TENANT.into());
        let d = decide(&context(), &admin(), Read, &foreign);
        assert_eq!((d.verdict, d.reason), (Verdict::Invisible, "TENANT_MISMATCH"));
    }

    #[test]
    fn step3_instance_admin_full_mask() {
        let d = decide(&context(), &admin(), Delete, &target());
        assert_eq!(d.verdict, Verdict::Allowed);
        assert!(FIELDS.iter().all(|f| d.readable_fields.contains(*f)));
    }

    #[test]
    fn step4_token_bound_to_one_base() {
        let mut c = context();
        c.actor = Actor { kind: ActorKind::Token, id: "tok-1".into(), token_id: None };
        let g = ActorGrants { token_base_id: Some(Some("another-base".into())), ..grants_for(&[Read]) };
        let d = decide(&c, &g, Read, &target());
        assert_eq!((d.verdict, d.reason), (Verdict::Invisible, "TOKEN_SCOPE"));
    }

    #[test]
    fn step9_without_read_invisible() {
        let d = decide(&context(), &grants_for(&[Create]), Create, &target());
        assert_eq!((d.verdict, d.reason), (Verdict::Invisible, "NO_READ"));
    }

    #[test]
    fn step9_read_without_verb_forbidden() {
        let d = decide(&context(), &grants_for(&[Read]), Delete, &target());
        assert_eq!((d.verdict, d.reason), (Verdict::Forbidden, "ACTION_NOT_GRANTED"));
    }

    #[test]
    fn empty_mask_invisible() {
        let g = ActorGrants { roles: vec![role("r-1", &[Read], FIELDS.iter().map(|f| hidden(f)).collect())], ..Default::default() };
        let d = decide(&context(), &g, Read, &target());
        assert_eq!((d.verdict, d.reason), (Verdict::Invisible, "EMPTY_MASK"));
    }

    #[test]
    fn base_covers_tables_and_applications_evaluated_at_decision() {
        assert_eq!(decide(&context(), &grants_for(&[Read]), Read, &target()).verdict, Verdict::Allowed);
        let g = ActorGrants { roles: vec![Role { id: "r-app".into(), permissions: vec![perm(Read, ScopeKind::Application, "app-ventes")], field_restrictions: vec![] }], ..Default::default() };
        let mut inside = target();
        inside.application_ids = vec!["app-ventes".into()];
        let mut outside = target();
        outside.application_ids = vec!["app-rh".into()];
        assert_eq!(decide(&context(), &g, Read, &inside).verdict, Verdict::Allowed);
        assert_eq!(decide(&context(), &g, Read, &outside).verdict, Verdict::Invisible);
    }

    #[test]
    fn union_wins() {
        let g = ActorGrants { roles: vec![role("rh", &[Read], vec![]), role("support", &[Read], vec![hidden("f-salaire")])], ..Default::default() };
        let d = decide(&context(), &g, Read, &target());
        assert_eq!(d.verdict, Verdict::Allowed);
        assert!(d.readable_fields.contains("f-salaire"));
    }

    #[test]
    fn highest_level_field_by_field() {
        let saisie = Role {
            id: "saisie".into(),
            permissions: [Read, Create, Update].iter().map(|a| perm(*a, ScopeKind::Table, TABLE)).collect(),
            field_restrictions: vec![read_only("f-montant")],
        };
        let g = ActorGrants { roles: vec![role("lecteurs", &[Read], vec![]), saisie], ..Default::default() };
        let d = decide(&context(), &g, Update, &target());
        assert_eq!(d.verdict, Verdict::Allowed);
        assert!(d.readable_fields.contains("f-montant"));
        assert!(!d.writable_fields.contains("f-montant"));
        assert!(d.writable_fields.contains("f-numero"));
    }

    #[test]
    fn system_columns_readable_never_writable() {
        let d = decide(&context(), &grants_for(&[Read, Update]), Update, &target());
        for c in SYSTEM_COLUMNS {
            assert!(d.readable_fields.contains(c));
            assert!(!d.writable_fields.contains(c));
        }
    }

    #[test]
    fn read_alone_grants_no_writable_field() {
        let d = decide(&context(), &grants_for(&[Read]), Read, &target());
        assert!(d.writable_fields.is_empty());
        assert_eq!(d.clearable_fields.len(), d.readable_fields.len());
    }

    #[test]
    fn read_only_field() {
        let g = ActorGrants { roles: vec![role("r-1", &[Read, Update], vec![read_only("f-montant")])], ..Default::default() };
        let d = decide(&context(), &g, Update, &target());
        assert!(d.readable_fields.contains("f-montant"));
        assert!(!d.writable_fields.contains("f-montant"));
        assert!(d.clearable_fields.contains("f-montant"));
    }

    #[test]
    fn row_predicate_always_emitted() {
        assert_eq!(decide(&context(), &grants_for(&[Read]), Read, &target()).row_predicate, "TRUE");
        assert_eq!(decide(&context(), &grants_for(&[]), Read, &target()).row_predicate, "FALSE");
        assert_eq!(decide(&context(), &grants_for(&[Read]), Delete, &target()).row_predicate, "FALSE");
    }

    #[test]
    fn surface_restricts() {
        let mut c = with_surface(context(), Surface::Mcp);
        c.actor = Actor { kind: ActorKind::Token, id: "tok-1".into(), token_id: None };
        let g = ActorGrants { token_allowed_surfaces: Some(vec![Surface::Rest]), ..grants_for(&[Read]) };
        let d = decide(&c, &g, Read, &target());
        assert_eq!((d.verdict, d.reason), (Verdict::Forbidden, "TOKEN_INVALID"));
    }

    fn token_role(actions: &[Action], r: Vec<FieldRestriction>) -> Option<Role> {
        Some(role("r-token", actions, r))
    }

    #[test]
    fn read_only_token_refused_by_its_role() {
        let g = ActorGrants { token_role: token_role(&[Read], vec![]), ..grants_for(&[Read, Create, Update]) };
        assert_eq!(decide(&token_ctx(), &g, Read, &target()).verdict, Verdict::Allowed);
        let w = decide(&token_ctx(), &g, Update, &target());
        assert_eq!((w.verdict, w.reason), (Verdict::Forbidden, "TOKEN_ACTION_NOT_GRANTED"));
    }

    #[test]
    fn writing_token_refused_by_its_creator() {
        let g = ActorGrants { token_role: token_role(&[Read, Create, Update], vec![]), ..grants_for(&[Read]) };
        let w = decide(&token_ctx(), &g, Update, &target());
        assert_eq!((w.verdict, w.reason), (Verdict::Forbidden, "ACTION_NOT_GRANTED"));
    }

    #[test]
    fn creator_without_rights_token_sees_nothing() {
        let g = ActorGrants { token_role: token_role(&[Read], vec![]), ..Default::default() };
        assert_eq!(decide(&token_ctx(), &g, Read, &target()).verdict, Verdict::Invisible);
    }

    #[test]
    fn field_masks_intersect() {
        let g = ActorGrants { token_role: token_role(&[Read, Update], vec![hidden("f-salaire")]), ..grants_for(&[Read, Update]) };
        let d = decide(&token_ctx(), &g, Update, &target());
        assert!(!d.readable_fields.contains("f-salaire"));
        assert!(!d.writable_fields.contains("f-salaire"));
        assert!(d.writable_fields.contains("f-numero"));
    }

    #[test]
    fn admin_token_keeps_scope_and_role() {
        let g = ActorGrants { is_instance_admin: true, token_role: token_role(&[Read], vec![]), token_base_id: Some(Some("another-base".into())), ..Default::default() };
        assert_eq!(decide(&token_ctx(), &g, Read, &target()).reason, "TOKEN_SCOPE");
        let in_scope = ActorGrants { token_base_id: Some(Some(BASE.into())), ..g };
        assert_eq!(decide(&token_ctx(), &in_scope, Update, &target()).reason, "TOKEN_ACTION_NOT_GRANTED");
    }

    #[test]
    fn whole_base_token_opens_environments() {
        let g = ActorGrants {
            is_instance_admin: true,
            token_role: token_role(&[Read], vec![]),
            token_base_id: Some(Some("the-production".into())),
            token_base_ids: Some(vec!["the-production".into(), BASE.into()]),
            ..Default::default()
        };
        assert_eq!(decide(&token_ctx(), &g, Read, &target()).verdict, Verdict::Allowed);
        let elsewhere = ActorGrants { token_base_ids: Some(vec!["the-production".into(), "the-recette".into()]), ..g };
        assert_eq!(decide(&token_ctx(), &elsewhere, Read, &target()).reason, "TOKEN_SCOPE");
    }

    fn withheld() -> Target {
        let mut t = target();
        t.agent_hidden_field_ids = vec!["f-salaire".into()];
        t
    }

    #[test]
    fn agent_hidden_field_only_on_mcp() {
        let agent = with_surface(context(), Surface::Mcp);
        let on_mcp = decide(&agent, &grants_for(&[Read, Update]), Update, &withheld());
        assert!(!on_mcp.readable_fields.contains("f-salaire"));
        assert!(!on_mcp.writable_fields.contains("f-salaire"));
        let on_rest = decide(&context(), &grants_for(&[Read]), Read, &withheld());
        assert!(on_rest.readable_fields.contains("f-salaire"));
        assert!(!decide(&agent, &admin(), Read, &withheld()).readable_fields.contains("f-salaire"));
    }

    #[test]
    fn every_field_withheld_or_base_closed() {
        let agent = with_surface(context(), Surface::Mcp);
        let mut all = target();
        all.agent_hidden_field_ids = FIELDS.iter().map(|s| s.to_string()).collect();
        let d = decide(&agent, &grants_for(&[Read]), Read, &all);
        assert_eq!((d.verdict, d.reason), (Verdict::Invisible, "EMPTY_MASK"));
        let mut closed = target();
        closed.agents_excluded = true;
        assert_eq!(decide(&agent, &admin(), Read, &closed).verdict, Verdict::Invisible);
        assert_eq!(decide(&context(), &admin(), Read, &closed).verdict, Verdict::Allowed);
    }

    #[test]
    fn row_rules_union_and_personalized() {
        let mut t = target();
        t.row_rules.insert("r-1".into(), "\"basedb_row\".\"owner\" = 'ffffffff-ffff-4fff-bfff-ffffffffffff'".into());
        let mut c = context();
        c.actor = Actor::user("018f3c2a-0000-7000-8000-0000000000aa");
        let d = decide(&c, &grants_for(&[Read]), Read, &t);
        assert_eq!(d.row_predicate, "\"basedb_row\".\"owner\" = '018f3c2a-0000-7000-8000-0000000000aa'");
        let g = ActorGrants { roles: vec![role("r-1", &[Read], vec![]), role("r-2", &[Read], vec![])], ..Default::default() };
        assert_eq!(decide(&c, &g, Read, &t).row_predicate, "TRUE");
    }
}
