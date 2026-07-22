export class TraceboardApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = "TraceboardApiError";
    this.status = status;
    this.code = code;
  }
}

function encode(value) {
  return encodeURIComponent(String(value));
}

async function responseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export class TraceboardApiClient {
  constructor({ baseUrl, token, timeoutMs = 15000, fetchImpl = globalThis.fetch }) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.timeoutMs = timeoutMs;
    this.fetch = fetchImpl;
  }

  async request(method, path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetch(new URL(path, `${this.baseUrl}/`), {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.token}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" })
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal
      });
      const data = await responseBody(response);
      if (!response.ok) {
        throw new TraceboardApiError(data?.message || `TraceBoard API returned ${response.status}`, {
          status: response.status,
          code: data?.code
        });
      }
      return data;
    } catch (error) {
      if (error instanceof TraceboardApiError) throw error;
      if (error?.name === "AbortError") {
        throw new TraceboardApiError("TraceBoard API request timed out");
      }
      throw new TraceboardApiError("TraceBoard API request failed");
    } finally {
      clearTimeout(timer);
    }
  }

  listProjects() {
    return this.request("GET", "/api/projects");
  }

  getProject(project) {
    return this.request("GET", `/api/projects/${encode(project)}`);
  }

  createProject(input) {
    return this.request("POST", "/api/projects", input);
  }

  updateProject(project, input) {
    return this.request("PATCH", `/api/projects/${encode(project)}`, input);
  }

  deleteProject(project) {
    return this.request("DELETE", `/api/projects/${encode(project)}`);
  }

  listRequirements(project) {
    return this.request("GET", `/api/projects/${encode(project)}/requirements`);
  }

  getRequirement(project, requirementId) {
    return this.request("GET", `/api/projects/${encode(project)}/requirements/${encode(requirementId)}`);
  }

  getRequirementHistory(project, requirementId) {
    return this.request("GET", `/api/projects/${encode(project)}/requirements/${encode(requirementId)}/events`);
  }

  createRequirement(project, input) {
    return this.request("POST", `/api/projects/${encode(project)}/requirements`, input);
  }

  updateRequirement(project, requirementId, input) {
    return this.request("PATCH", `/api/projects/${encode(project)}/requirements/${encode(requirementId)}`, input);
  }

  deleteRequirement(project, requirementId) {
    return this.request("DELETE", `/api/projects/${encode(project)}/requirements/${encode(requirementId)}`);
  }

  addRequirementNote(project, requirementId, text) {
    return this.request("POST", `/api/projects/${encode(project)}/requirements/${encode(requirementId)}/events`, {
      kind: "note.add",
      text
    });
  }
}
