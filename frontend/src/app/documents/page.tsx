import WorkspaceShell from "../../components/layout/WorkspaceShell";

export default function DocumentsPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.18),transparent_45%),radial-gradient(circle_at_bottom,_rgba(16,185,129,0.12),transparent_40%)] p-4 md:p-6">
      <WorkspaceShell initialView="documents" />
    </main>
  );
}
