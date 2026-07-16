import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { readFile, writeFile } from 'node:fs/promises';
import React from 'react'; // Нужно для JSX

// Читаем шрифт как Buffer (в Node.js этого достаточно для Satori)
const fontBuffer = await readFile('./assets/animeacev.ttf');

const fontArrayBuffer = fontBuffer.buffer.slice(
  fontBuffer.byteOffset,
  fontBuffer.byteOffset + fontBuffer.byteLength
);

const fonts = [
  {
    name: 'animeacev',
    data: fontArrayBuffer
  }
];

const WelcomeComponent = ({ name, avatarUrl }: { name: string, avatarUrl: string; }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100vw',
    height: '100vh',
    gap: 10,
    padding: 20,
    boxSizing: 'border-box',
    backgroundColor: 'rgba(0,0,0,0.25)'
  }}>
    <div style={{
      display: 'block',
      width: 128,
      height: 128,
      borderRadius: '100%',
      border: '5px solid #555',
      background: `url(${avatarUrl}) center cover`
    }} />

    <span style={{
      fontFamily: 'animeacev',
      color: '#fff',
      fontSize: 30,
      textShadow: '0 0 10px #000',
      textAlign: 'center'
    }}>
      {name}
    </span>
  </div>
);


export default async function makeWelcome(
  name: string,
  avatarUrl: string,
  width: number,
  height: number,
  outfile: string
) {
  // Генерация SVG через Satori
  const svg = await satori(
    <WelcomeComponent name={name} avatarUrl={avatarUrl} />,
    {
      width,
      height,
      fonts
    }
  );

  // Рендеринг в PNG с помощью Resvg
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: width,
    },
  });

  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  // Записываем файл через стандартный fs Node.js
  await writeFile(outfile, pngBuffer);
}
