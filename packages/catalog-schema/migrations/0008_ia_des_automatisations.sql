-- ────────────────────────────────────────────────────────────────────────
-- 0008 — L'IA dans les automatisations (chapitre 17 §1.3, chapitre 12 §1.5).
--
-- Une étape d'automatisation peut demander une réponse au fournisseur d'IA, comme une
-- cellule IA. Ses appels sont journalisés dans `_basedb.ai_call` sous leur propre nature,
-- `automation`, et non sous celle des cellules : le journal dit d'où vient chaque appel.
-- Ils comptent dans le plafond horaire des calculs de fond, avec les cellules.
--
-- Rejouable : la contrainte est retirée, quel que soit son nom, puis remise.
-- ────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  existing text;
BEGIN
  FOR existing IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = '_basedb.ai_call'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%usage_kind%'
  LOOP
    EXECUTE format('ALTER TABLE _basedb.ai_call DROP CONSTRAINT %I', existing);
  END LOOP;
END $$;

ALTER TABLE _basedb.ai_call ADD CONSTRAINT ai_call_usage_kind_check
  CHECK (usage_kind IN ('structure_draft','expression_draft','field_compute','copilot',
                        'template_draft','automation'));
