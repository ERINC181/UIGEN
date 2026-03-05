import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const mockSignIn = vi.mocked(signInAction);
const mockSignUp = vi.mocked(signUpAction);
const mockGetAnonWorkData = vi.mocked(getAnonWorkData);
const mockClearAnonWork = vi.mocked(clearAnonWork);
const mockGetProjects = vi.mocked(getProjects);
const mockCreateProject = vi.mocked(createProject);

const ANON_WORK_WITH_MESSAGES = {
  messages: [{ role: "user", content: "hello" }],
  fileSystemData: { "/": { name: "/", type: "directory" } },
};

const EXISTING_PROJECT = { id: "proj-123", name: "My Design" };
const NEW_PROJECT = { id: "proj-new", name: "New Design" };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue(NEW_PROJECT as any);
});

describe("useAuth – isLoading", () => {
  it("starts as false", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  it("is true during signIn and false after", async () => {
    let resolveSignIn!: (v: any) => void;
    mockSignIn.mockReturnValue(new Promise((r) => (resolveSignIn = r)));

    const { result } = renderHook(() => useAuth());

    let signInPromise: Promise<any>;
    act(() => {
      signInPromise = result.current.signIn("a@b.com", "password");
    });
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSignIn({ success: false, error: "Invalid credentials" });
      await signInPromise;
    });
    expect(result.current.isLoading).toBe(false);
  });

  it("is true during signUp and false after", async () => {
    let resolveSignUp!: (v: any) => void;
    mockSignUp.mockReturnValue(new Promise((r) => (resolveSignUp = r)));

    const { result } = renderHook(() => useAuth());

    let signUpPromise: Promise<any>;
    act(() => {
      signUpPromise = result.current.signUp("a@b.com", "password");
    });
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSignUp({ success: false, error: "Email already registered" });
      await signUpPromise;
    });
    expect(result.current.isLoading).toBe(false);
  });

  it("resets isLoading to false even when signIn throws", async () => {
    mockSignIn.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await expect(result.current.signIn("a@b.com", "password")).rejects.toThrow(
        "network error"
      );
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("resets isLoading to false even when signUp throws", async () => {
    mockSignUp.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await expect(result.current.signUp("a@b.com", "password")).rejects.toThrow(
        "network error"
      );
    });

    expect(result.current.isLoading).toBe(false);
  });
});

describe("useAuth – signIn", () => {
  it("returns the result from the action on failure", async () => {
    const failure = { success: false, error: "Invalid credentials" };
    mockSignIn.mockResolvedValue(failure);

    const { result } = renderHook(() => useAuth());
    let returned: any;

    await act(async () => {
      returned = await result.current.signIn("a@b.com", "wrong");
    });

    expect(returned).toEqual(failure);
  });

  it("does not run post-sign-in logic when sign in fails", async () => {
    mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "wrong");
    });

    expect(mockGetAnonWorkData).not.toHaveBeenCalled();
    expect(mockGetProjects).not.toHaveBeenCalled();
    expect(mockCreateProject).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("calls signInAction with provided credentials", async () => {
    mockSignIn.mockResolvedValue({ success: false });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "secret123");
    });

    expect(mockSignIn).toHaveBeenCalledWith("user@example.com", "secret123");
  });
});

describe("useAuth – signUp", () => {
  it("returns the result from the action on failure", async () => {
    const failure = { success: false, error: "Email already registered" };
    mockSignUp.mockResolvedValue(failure);

    const { result } = renderHook(() => useAuth());
    let returned: any;

    await act(async () => {
      returned = await result.current.signUp("a@b.com", "password123");
    });

    expect(returned).toEqual(failure);
  });

  it("does not run post-sign-in logic when sign up fails", async () => {
    mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("a@b.com", "password123");
    });

    expect(mockGetAnonWorkData).not.toHaveBeenCalled();
    expect(mockGetProjects).not.toHaveBeenCalled();
    expect(mockCreateProject).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("calls signUpAction with provided credentials", async () => {
    mockSignUp.mockResolvedValue({ success: false });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("new@example.com", "mypassword");
    });

    expect(mockSignUp).toHaveBeenCalledWith("new@example.com", "mypassword");
  });
});

describe("useAuth – post-sign-in: anonymous work with messages", () => {
  beforeEach(() => {
    mockGetAnonWorkData.mockReturnValue(ANON_WORK_WITH_MESSAGES);
    mockCreateProject.mockResolvedValue({ id: "anon-proj" } as any);
  });

  it("creates a project with anonymous messages and file system data", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: ANON_WORK_WITH_MESSAGES.messages,
        data: ANON_WORK_WITH_MESSAGES.fileSystemData,
      })
    );
  });

  it("clears anonymous work after creating the project", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password");
    });

    expect(mockClearAnonWork).toHaveBeenCalled();
  });

  it("navigates to the created project", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password");
    });

    expect(mockPush).toHaveBeenCalledWith("/anon-proj");
  });

  it("does not call getProjects when anonymous work exists", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password");
    });

    expect(mockGetProjects).not.toHaveBeenCalled();
  });

  it("also works for signUp", async () => {
    mockSignUp.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("a@b.com", "password");
    });

    expect(mockCreateProject).toHaveBeenCalled();
    expect(mockClearAnonWork).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/anon-proj");
  });
});

describe("useAuth – post-sign-in: anonymous work with no messages (empty session)", () => {
  beforeEach(() => {
    mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
    mockGetProjects.mockResolvedValue([EXISTING_PROJECT] as any);
  });

  it("falls through to getProjects when anon work has no messages", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password");
    });

    expect(mockGetProjects).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith(`/${EXISTING_PROJECT.id}`);
  });
});

describe("useAuth – post-sign-in: no anonymous work, existing projects", () => {
  beforeEach(() => {
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([EXISTING_PROJECT, { id: "proj-older" }] as any);
  });

  it("navigates to the most recent project", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password");
    });

    expect(mockPush).toHaveBeenCalledWith(`/${EXISTING_PROJECT.id}`);
  });

  it("does not create a new project", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password");
    });

    expect(mockCreateProject).not.toHaveBeenCalled();
  });

  it("also works for signUp", async () => {
    mockSignUp.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("a@b.com", "password");
    });

    expect(mockPush).toHaveBeenCalledWith(`/${EXISTING_PROJECT.id}`);
    expect(mockCreateProject).not.toHaveBeenCalled();
  });
});

describe("useAuth – post-sign-in: no anonymous work, no existing projects", () => {
  beforeEach(() => {
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue(NEW_PROJECT as any);
  });

  it("creates a new project", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [], data: {} })
    );
  });

  it("navigates to the newly created project", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password");
    });

    expect(mockPush).toHaveBeenCalledWith(`/${NEW_PROJECT.id}`);
  });

  it("does not clear anonymous work (there was none)", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password");
    });

    expect(mockClearAnonWork).not.toHaveBeenCalled();
  });

  it("also works for signUp", async () => {
    mockSignUp.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("a@b.com", "password");
    });

    expect(mockCreateProject).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith(`/${NEW_PROJECT.id}`);
  });
});
