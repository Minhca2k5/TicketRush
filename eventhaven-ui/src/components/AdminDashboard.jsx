const AdminDashboard = () => {
  return (
    <div className="admin-dashboard-shell">
      <section className="admin-hero">
        <div>
          <span className="admin-eyebrow">Admin Workspace</span>
          <h2>Manage events, seating, and launch readiness.</h2>
          <p>Use the admin panel to create event listings, generate seat maps, and prepare booking data for demo flows.</p>
        </div>
        <a className="admin-primary-action" href="/admin/events">Manage Events & Seats</a>
      </section>

      <section className="admin-quick-grid">
        <div className="admin-quick-card">
          <strong>Events</strong>
          <span>Create and update event details.</span>
        </div>
        <div className="admin-quick-card">
          <strong>Seat Maps</strong>
          <span>Generate zones, tiers, and seats.</span>
        </div>
        <div className="admin-quick-card">
          <strong>Demo Flow</strong>
          <span>Prepare data for customer booking.</span>
        </div>
      </section>
    </div>
  );
};

export default AdminDashboard;
