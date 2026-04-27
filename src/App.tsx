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
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/categories" element={<CategorySelect />} />
          <Route path="/categories/:categoryId" element={<PageGrid />} />
          <Route path="/color/:pageId" element={<ColoringScreen />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/gallery/:artworkId" element={<ArtworkDetail />} />
          <Route path="/parent" element={<ParentDashboard />} />
          <Route path="/parent/photo-to-outline" element={<PhotoToOutline />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
