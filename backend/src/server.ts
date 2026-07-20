import { createServer } from 'http';
import app from './app';
import { initSockets } from './sockets/socket';

const PORT = process.env.PORT || 5000;
const server = createServer(app);

// Attach Socket.IO
initSockets(server);

server.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 Kanban Collaborative Server running on port ${PORT}`);
  console.log(`📝 Swagger Docs available at http://localhost:${PORT}/api-docs`);
  console.log(`==================================================`);
});
