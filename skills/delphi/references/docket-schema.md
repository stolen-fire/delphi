# Docket.json schema

Both lightweight and standard protocols write `{docket-path}/docket.json` using this structure. Populate fields from the composition YAML (standard) or hardcoded defaults (lightweight).

```json
{
  "id": "{docket-name}",
  "created": "{ISO 8601 timestamp}",
  "composition": "{composition name}",
  "mode": "{lightweight|standard}",
  "tone": "{tone name, or omit field if no tone}",
  "proposition_summary": "{first sentence of proposition.md}",
  "input_artifacts": ["{list of input file paths}"],
  "evidence": {
    "source": "{evidence path from CLI flag or YAML field}",
    "source_type": "{cli_flag | yaml_field | none}",
    "files": [
      {
        "filename": "{original filename}",
        "sha256": "{hash}",
        "method": "{born-digital | tesseract-ocr | direct-copy | failed}",
        "confidence": "{high | medium | low}"
      }
    ]
  },
  "mcp_grounding": {
    "server": "{MCP server name}",
    "required": "{true | false}",
    "available": "{true | false}",
    "components": ["{list of components grounded from imports}"],
    "tools_called": ["{list of MCP tool names actually invoked}"]
  },
  "appendix": {
    "present": "{true | false}",
    "researcher": "{role_name}",
    "verified_cases": "{count}",
    "verified_absences": "{count}",
    "addenda": "{count}"
  },
  "verification": {
    "present": "{true | false}",
    "auditor": "{role_name}",
    "claims_total": "{N}",
    "claims_verified": "{M}",
    "confirmed": "{count}",
    "refuted": "{count}",
    "inconclusive": "{count}",
    "not_checked": "{N-M}"
  },
  "delegates": [
    {
      "role": "{role}",
      "prompt_register": "{prompt_register}",
      "grounding": "{grounding path or null}",
      "capabilities": ["{capabilities}"]
    }
  ],
  "rules": {
    "max_rounds": "{number}",
    "independent_positions": "{false for lightweight, true for standard}",
    "require_dissent_record": "{boolean}",
    "human_deferral": "{boolean}",
    "veto_roles": ["{standard only — omit for lightweight}"]
  },
  "rounds": [
    {
      "round": "{N}",
      "positions_filed": "{count}",
      "challenges_filed": "{count}",
      "responses_filed": "{count}",
      "synthesis_status": "{settled|contested|vetoed}",
      "contested_points": ["{list}"],
      "parallel_dispatches": ["{standard only — omit for lightweight}"]
    }
  ],
  "outcome": "{ratified|ratified_with_dissent|forced|deferred|vetoed}",
  "dissent": {
    "present": "{true|false}",
    "delegate": "{role if present}",
    "concern": "{concern text if present}"
  },
  "provenance": [
    {
      "decision": "{key decision}",
      "proposed_by": "{role}",
      "challenged_by": "{role}",
      "challenge": "{challenge text}",
      "resolved_by": "{role or consensus}",
      "resolution": "{how resolved}"
    }
  ]
}
```

**Omission rule:** If evidence was not provided, appendix was not produced, or verification was not performed, omit the corresponding top-level field entirely from the JSON. Do not set it to `null` or include an empty stub.

## Code review docket.json schema

Code review mode uses a different docket.json structure:

```json
{
  "id": "{docket-name}",
  "created": "{ISO 8601 timestamp}",
  "mode": "code-review",
  "tone": "{tone name, or omit if none}",
  "review_target": {
    "type": "{files | diff}",
    "paths": ["{list of file paths}"],
    "diff_ref": "{git ref or 'staged', omit if file mode}",
    "conventions": "{conventions file path, omit if none}"
  },
  "delegates": [
    {
      "role": "{role}",
      "role_type": "{participant | challenger | auditor}",
      "agent": "{agent file name}"
    }
  ],
  "rules": {
    "max_rounds": 1,
    "independent_challenges": true,
    "enforcer_active": "{true | false}"
  },
  "lint": {
    "detected": true,
    "tools": ["eslint", "stylelint"],
    "errors": "{N}",
    "warnings": "{M}"
  },
  "mcp_grounding": {
    "server": "{MCP server name}",
    "required": "{true | false}",
    "available": "{true | false}",
    "phase_a_components": ["{list of components grounded from imports}"],
    "phase_b_components": ["{list of components added from Cartographer recommendations}"],
    "tools_called": ["{list of MCP tool names actually invoked}"]
  },
  "cartographer": {
    "replacements_proposed": "{N}",
    "variant_corrections": "{N}",
    "subcomponent_opportunities": "{N}",
    "violations_eliminable": "{N}",
    "advocate_conceded": "{N}",
    "advocate_defended": "{N}"
  },
  "outcome": "{clean | findings}",
  "remediation": {
    "critical": "{count}",
    "recommended": "{count}",
    "optional": "{count}"
  },
  "provenance": [
    {
      "finding": "{finding title}",
      "raised_by": "{role}",
      "response": "{DEFEND | CONCEDE | DISSENT | none}",
      "resolution": "{settled | contested | conceded | dissent}"
    }
  ]
}
```

**Omission rules:** Omit the `lint` block if no linter config was detected. Omit the `cartographer` block if the Cartographer did not run (e.g., composition overrides without a cartographer delegate). Omit the `mcp_grounding` block if no `mcp:` field was present in the composition YAML. If MCP was configured but unavailable (`available: false`), include the block to record that the grounding was attempted but failed.
