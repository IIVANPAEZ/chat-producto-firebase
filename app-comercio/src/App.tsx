import { env } from './config/env';
import { ChatPage } from './chat/pages/ChatPage';

function App() {
  return <ChatPage chatId={env.chatId} />;
}

export default App;
