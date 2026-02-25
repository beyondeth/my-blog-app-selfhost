import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/widget.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}

export default App;
