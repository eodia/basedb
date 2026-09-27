-- ────────────────────────────────────────────────────────────────────────
-- 0010 — Un quatrième fournisseur d'IA, `openai_compatible` (chapitre 12 §2).
--
-- Tout serveur qui parle l'API de conversation d'OpenAI à une adresse donnée par
-- l'exploitant (BASEDB_AI_BASE_URL) : Azure, une passerelle d'entreprise, un modèle
-- servi sur sa propre machine. Ses appels sont journalisés dans `_basedb.ai_call` sous
-- ce nom, et non sous `openai` : le journal dit à qui les données sont parties.
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
       AND pg_get_constraintdef(oid) LIKE '%provider%'
  LOOP
    EXECUTE format('ALTER TABLE _basedb.ai_call DROP CONSTRAINT %I', existing);
  END LOOP;
END $$;

ALTER TABLE _basedb.ai_call ADD CONSTRAINT ai_call_provider_check
  CHECK (provider IN ('openai','anthropic','mistral','openai_compatible'));
