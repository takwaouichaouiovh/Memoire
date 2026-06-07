import WorkspaceShell from "../../components/layout/WorkspaceShell";

export default function WorkspacePage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-5 md:px-6 md:py-6">
      <WorkspaceShell initialView="chat" />
    </main>
  );
}
