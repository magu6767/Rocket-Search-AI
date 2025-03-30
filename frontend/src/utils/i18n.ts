/**
 * Chrome i18n APIを使用してメッセージを取得する関数
 * @param messageName メッセージID
 * @param substitutions 置換文字列の配列（オプション）
 * @returns ローカライズされた文字列
 */
export function getMessage(messageName: string, substitutions?: string | string[]): string {
  if (!chrome.i18n) {
    console.warn('chrome.i18n API is not available');
    return messageName;
  }

  return chrome.i18n.getMessage(messageName, substitutions);
}

/**
 * React コンポーネント内でのローカライズテキスト取得をシンプルにするヘルパー関数
 * 使用例: const t = useTranslation();
 *        t('messageKey')
 */
export function useTranslation() {
  return getMessage;
} 