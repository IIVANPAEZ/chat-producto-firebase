import { env } from './config/env';
import { ChatPage } from './pages/ChatPage';

function App() {
  return <ChatPage chatId={env.chatId} />;
}

export default App;
