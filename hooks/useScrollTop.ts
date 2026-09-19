import { useEffect } from 'react';

export function useScrollTop(dependency: any) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [dependency]);
}
