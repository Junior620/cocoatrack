// CocoaTrack V2 - Geo-blocked page
// Shown to users outside Cameroon

export default function BlockedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
      <div className="max-w-md mx-auto p-8 bg-white rounded-2xl shadow-xl text-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
          <svg 
            className="w-10 h-10 text-red-600" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
            />
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Accès non autorisé
        </h1>
        
        <p className="text-gray-600 mb-6">
          Cette application est réservée aux utilisateurs situés au Cameroun.
          <br />
          <span className="text-sm text-gray-500 mt-2 block">
            This application is only available for users in Cameroon.
          </span>
        </p>
        
        <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-sm text-amber-800">
            Si vous êtes au Cameroun et voyez ce message, veuillez contacter 
            l&apos;administrateur de votre coopérative.
          </p>
        </div>
        
        <div className="mt-8 text-xs text-gray-400">
          CocoaTrack - Gestion des coopératives cacaoyères
        </div>
      </div>
    </div>
  );
}
