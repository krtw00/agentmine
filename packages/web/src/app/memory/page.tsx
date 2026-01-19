export default function MemoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Memory</h1>
        <p className="text-muted-foreground">
          Browse shared knowledge and context storage
        </p>
      </div>
      <div className="rounded-lg border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Memory entries will be displayed here
        </p>
      </div>
    </div>
  );
}
