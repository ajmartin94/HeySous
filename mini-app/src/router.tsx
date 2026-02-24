import { createBrowserRouter } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Hub } from './pages/Hub';
import { Grocery } from './pages/Grocery';
import { Recipes } from './pages/Recipes';
import { MealPlan } from './pages/MealPlan';
import { Feedback } from './pages/Feedback';
import { Help } from './pages/Help';
import { Settings } from './pages/Settings';

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Layout />,
      children: [
        { index: true, element: <Hub /> },
        { path: 'grocery', element: <Grocery /> },
        { path: 'recipes', element: <Recipes /> },
        { path: 'plan', element: <MealPlan /> },
        { path: 'feedback', element: <Feedback /> },
        { path: 'help', element: <Help /> },
        { path: 'settings', element: <Settings /> },
      ],
    },
  ],
  {
    basename: '/app',
  },
);
