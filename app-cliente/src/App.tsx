import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { env } from './config/env';
import { ChatScreen } from './chat/screens/ChatScreen';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ChatScreen chatId={env.chatId} />
    </SafeAreaProvider>
  );
}

export default App;
