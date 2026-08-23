export interface ReadinessDependency {
  name: string;
  check: () => Promise<unknown>;
}

export interface ReadinessResult {
  ready: boolean;
  checks: Record<string, "up" | "down">;
}

export async function checkReadiness(
  dependencies: ReadinessDependency[],
): Promise<ReadinessResult> {
  const results = await Promise.allSettled(
    dependencies.map((dependency) => dependency.check()),
  );
  const checks: Record<string, "up" | "down"> = {};
  dependencies.forEach((dependency, index) => {
    checks[dependency.name] =
      results[index].status === "fulfilled" ? "up" : "down";
  });

  return {
    ready: results.every((result) => result.status === "fulfilled"),
    checks,
  };
}
