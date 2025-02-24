import { useState, useEffect } from 'react'
import { IoRocketSharp } from "react-icons/io5";
import './App.css'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // ストレージからidTokenを確認
    chrome.storage.local.get('idToken', (result) => {
      setIsLoggedIn(!!result.idToken);
      setIsLoading(false);
    });

    // ストレージの変更を監視
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.idToken) {
        setIsLoggedIn(!!changes.idToken.newValue);
      }
    };

    chrome.storage.local.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.local.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const signInWithGoogle = () => {
    console.log('signInWithGoogle');
    chrome.runtime.sendMessage({ action: 'signIn' }, (response) => {
      if (response?.success) {
        setIsLoggedIn(true);
      }
      console.log(response);
    });
  }

  const renderGoogleButton = () => (
    <button
      onClick={signInWithGoogle}
      style={{
        border: 'none',
        background: 'none',
        padding: 0,
        cursor: 'pointer',
        display: 'block',
        margin: '0 auto'
      }}
    >
      <img 
        src={chrome.runtime.getURL('src/content/web_neutral_sq_SI.svg')}
        alt="Googleでログイン"
      />
    </button>
  );

  if (isLoading) {
    return (
      <div style={{
        padding: '20px',
        width: '300px',
        textAlign: 'center'
      }}>
        読み込み中...
      </div>
    );
  }

  return (
    <div style={{
      padding: '20px',
      width: '300px',
      backgroundColor: 'white',
      textAlign: 'center'
    }}>
      <IoRocketSharp size={40} />
      <h2 style={{
        fontSize: '1.2em',
        marginBottom: '20px',
        color: '#333'
      }}>
        Rocket Search AI
      </h2>
      {isLoggedIn ? (
        <div style={{
          color: '#2ecc71',
          fontSize: '0.9em'
        }}>
          ログイン済みです。テキストを選択して分析を開始できます。
        </div>
      ) : (
        <>
          <div style={{
            marginBottom: '15px',
            color: '#666'
          }}>
            分析を開始するにはログインしてください
          </div>
          {renderGoogleButton()}
        </>
      )}
    </div>
  )
}

export default App
