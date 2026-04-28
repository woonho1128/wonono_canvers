import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import Home from './pages/Home';
import CategorySelect from './pages/CategorySelect';
import PageGrid from './pages/PageGrid';
import ColoringScreen from './pages/ColoringScreen';
import Gallery from './pages/Gallery';
import ArtworkDetail from './pages/ArtworkDetail';
import ParentDashboard from './pages/ParentDashboard';
import PhotoToOutline from './pages/PhotoToOutline';
import Login from './pages/Login';
import { AuthProvider } from './auth/AuthProvider';
import AuthGate from './components/AuthGate';

function ErrorFallback({ resetErrorBoundary }: { resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-full p-6 grid place-items-center text-center">
      <div>
        <div className="text-6xl">😢</div>
        <p className="text-kid-title mt-4">앗, 무언가 잘못됐어요</p>
        <button onClick={resetErrorBoundary} className="kid-btn bg-app-orange text-white px-6 mt-6">
          다시 시도
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<AuthGate><Home /></AuthGate>} />
            <Route path="/categories" element={<AuthGate><CategorySelect /></AuthGate>} />
            <Route path="/categories/:categoryId" element={<AuthGate><PageGrid /></AuthGate>} />
            <Route path="/color/:pageId" element={<AuthGate><ColoringScreen /></AuthGate>} />
            <Route path="/gallery" element={<AuthGate><Gallery /></AuthGate>} />
            <Route path="/gallery/:artworkId" element={<AuthGate><ArtworkDetail /></AuthGate>} />
            <Route path="/parent" element={<AuthGate><ParentDashboard /></AuthGate>} />
            <Route path="/parent/photo-to-outline" element={<AuthGate><PhotoToOutline /></AuthGate>} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
