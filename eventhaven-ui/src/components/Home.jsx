const Home = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/login';
    return null;
  }

  return (
    <div>
      <h1>Welcome to TicketRush</h1>
      <p>You are logged in.</p>
    </div>
  );
};

export default Home;