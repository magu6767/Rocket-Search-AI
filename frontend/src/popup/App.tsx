import { useState, useEffect } from 'react'
import { IoRocketSharp } from "react-icons/io5";
import './App.css'
import { useTranslation } from '../utils/i18n';

function App() {
  const t = useTranslation();
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
        alt={t('googleLoginAlt')}
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
        {t('loading')}
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
        {t('appName')}
      </h2>
      {isLoggedIn ? (
        <div style={{
          color: '#2ecc71',
          fontSize: '0.9em'
        }}>
          {t('loggedIn')}
        </div>
      ) : (
        <>
          <div style={{
            marginBottom: '15px',
            color: '#666'
          }}>
            {t('loginRequired')}
          </div>
          {renderGoogleButton()}
        </>
      )}
    </div>
  )
}

export default App
