import './App.css'

function App() {

  const signInWithGoogle = () => {
    console.log('signInWithGoogle');
    chrome.runtime.sendMessage({ action: 'signIn' }, (response) => {
      console.log(response);
    });
  }
  return (
    <>
      <button onClick={signInWithGoogle}>
        Sign in with Google
      </button>
    </>
  )
}

export default App
