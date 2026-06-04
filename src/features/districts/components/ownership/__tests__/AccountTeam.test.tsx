import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mutation spies (module-level so the mock factory and the tests share them).
const addCollaborator = vi.fn().mockResolvedValue({});
const removeCollaborator = vi.fn().mockResolvedValue({});
const addWatcher = vi.fn().mockResolvedValue({});
const removeWatcher = vi.fn().mockResolvedValue({});

const state = {
  collaborators: [] as Array<{ userId: string; user: { id: string; fullName: string | null; email: string; avatarUrl: string | null } }>,
  watchers: [] as Array<{ userId: string; user: { id: string; fullName: string | null; email: string; avatarUrl: string | null } }>,
  profileId: "me",
};

vi.mock("@/lib/api", () => ({
  useUsers: () => ({ data: [], isLoading: false }),
  useProfile: () => ({ data: { id: state.profileId } }),
  useCollaborators: () => ({ data: state.collaborators, isLoading: false }),
  useAddCollaborator: () => ({ mutateAsync: addCollaborator, isPending: false }),
  useRemoveCollaborator: () => ({ mutateAsync: removeCollaborator, isPending: false }),
  useWatchers: () => ({ data: state.watchers, isLoading: false }),
  useAddWatcher: () => ({ mutateAsync: addWatcher, isPending: false }),
  useRemoveWatcher: () => ({ mutateAsync: removeWatcher, isPending: false }),
}));

import CollaboratorsEditor from "../CollaboratorsEditor";
import WatchersEditor from "../WatchersEditor";

const person = (id: string, fullName: string | null) => ({
  userId: id,
  user: { id, fullName, email: `${id}@x.com`, avatarUrl: null },
});

beforeEach(() => {
  vi.clearAllMocks();
  state.collaborators = [];
  state.watchers = [];
  state.profileId = "me";
});

describe("CollaboratorsEditor", () => {
  it("shows an empty state when there are no collaborators", () => {
    render(<CollaboratorsEditor leaid="0601234" />);
    expect(screen.getByText("No collaborators")).toBeTruthy();
  });

  it("renders a chip per collaborator and removes by userId", () => {
    state.collaborators = [person("u1", "Ada Lovelace")];
    render(<CollaboratorsEditor leaid="0601234" />);

    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Remove Ada Lovelace"));
    expect(removeCollaborator).toHaveBeenCalledWith({ leaid: "0601234", userId: "u1" });
  });
});

describe("WatchersEditor watch toggle", () => {
  it("shows Watch and adds the current user when not watching", () => {
    state.watchers = [];
    render(<WatchersEditor leaid="0601234" />);

    const toggle = screen.getByRole("button", { name: "Watch" });
    fireEvent.click(toggle);
    expect(addWatcher).toHaveBeenCalledWith({ leaid: "0601234", userId: "me" });
  });

  it("shows Watching and removes the current user when already watching", () => {
    state.watchers = [person("me", "Me Myself")];
    render(<WatchersEditor leaid="0601234" />);

    const toggle = screen.getByRole("button", { name: "Watching" });
    fireEvent.click(toggle);
    expect(removeWatcher).toHaveBeenCalledWith({ leaid: "0601234", userId: "me" });
  });
});
