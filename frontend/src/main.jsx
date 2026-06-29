import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#0f9f8f',
          colorBgBase: '#f6f8fb',
          colorTextBase: '#17212f',
          colorBorder: '#d7dee8',
          borderRadius: 8
        }
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
