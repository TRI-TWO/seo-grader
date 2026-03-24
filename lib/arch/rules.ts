import type { ArchRule } from "./types";

export interface EvaluatedRule {
  rule: ArchRule;
  matched: boolean;
}

export function evaluateThresholdRule(
  rule: ArchRule,
  value: number
): EvaluatedRule {
  let matched = false;
  const op = rule.operator.trim();

  switch (op) {
    case ">":
      matched = value > rule.threshold;
      break;
    case ">=":
      matched = value >= rule.threshold;
      break;
    case "<":
      matched = value < rule.threshold;
      break;
    case "<=":
      matched = value <= rule.threshold;
      break;
    case "==":
    case "=":
      matched = value === rule.threshold;
      break;
    case "!=":
      matched = value !== rule.threshold;
      break;
    default:
      matched = false;
  }

  return { rule, matched };
}

export function evaluateRulesForSignal(
  rules: ArchRule[],
  value: number
): EvaluatedRule[] {
  const enabled = rules.filter((rule) => rule.is_enabled);

  return enabled.map((rule) => {
    if (rule.rule_type !== "threshold") {
      return { rule, matched: false };
    }
    return evaluateThresholdRule(rule, value);
  });
}

