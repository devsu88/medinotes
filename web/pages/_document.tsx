import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="it">
      <Head>
        <meta
          name="description"
          content="Note di visita strutturate e verificabili, con pseudonimizzazione locale prima di ogni chiamata al modello."
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
