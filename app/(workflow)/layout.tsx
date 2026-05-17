import Footer from "@/components/layout/Footer";

export default function WorkflowLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="workflow-theme flex h-screen flex-col overflow-hidden bg-background">
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <Footer />
    </div>
  );
}
