import { useLayoutEffect, useRef } from 'react';
import { useCatalog } from './hooks/useCatalog';
import { Layout } from './ui/Layout';
import { useRoute, wasArrivedByBack } from './ui/state';
import { PhonesPage } from './ui/PhonesPage';
import { PhonePage } from './ui/PhonePage';
import { ComparePage } from './ui/ComparePage';
import { LibraryPage } from './ui/LibraryPage';
import { ToolsPage } from './ui/ToolsPage';

export function App() {
  const route = useRoute();
  const catalog = useCatalog();
  // Scroll memory per screen: opening a phone starts at the top; going back returns to where you were.
  const memo = useRef(new Map<string, number>());
  const screen = `${route.page}/${route.id ?? ''}`;
  useLayoutEffect(() => {
    const back = wasArrivedByBack();
    const y = back ? memo.current.get(screen) ?? 0 : 0;
    window.scrollTo(0, y);
    return () => {
      memo.current.set(screen, window.scrollY);
    };
  }, [screen]);
  const devices = catalog.devices;

  let page;
  switch (route.page) {
    case 'phone':
      page = <PhonePage devices={devices} id={route.id ?? ''} />;
      break;
    case 'compare':
      page = <ComparePage devices={devices} />;
      break;
    case 'library':
      page = <LibraryPage />;
      break;
    case 'tools':
      page = <ToolsPage devices={devices} />;
      break;
    default:
      page = <PhonesPage devices={devices} query={route.query} />;
  }

  return (
    <Layout page={route.page} phoneCount={devices.length}>
      {page}
    </Layout>
  );
}
