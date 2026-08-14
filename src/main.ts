import {createExperienceController} from './app/experienceController';

const experience = createExperienceController();
let destroyed = false;

experience.start();

const handleVisibilityChange = (): void => {
  if (document.visibilityState === 'hidden') {
    experience.pause('hidden');
  } else {
    experience.resume();
  }
};

const handlePageHide = (event: PageTransitionEvent): void => {
  experience.pause('pagehide');
  if (!event.persisted) {
    cleanup();
  }
};

const handlePageShow = (): void => {
  if (!destroyed && document.visibilityState === 'visible') {
    experience.resume();
  }
};

const cleanup = (): void => {
  if (destroyed) {
    return;
  }

  destroyed = true;
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('pagehide', handlePageHide);
  window.removeEventListener('pageshow', handlePageShow);
  experience.destroy();
};

document.addEventListener('visibilitychange', handleVisibilityChange);
window.addEventListener('pagehide', handlePageHide);
window.addEventListener('pageshow', handlePageShow);

if (import.meta.hot) {
  import.meta.hot.dispose(cleanup);
}
