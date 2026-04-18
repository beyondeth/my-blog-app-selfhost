export interface RenderD2SourceOptions {
  pad?: number;
  scale?: number;
  salt?: string;
}

export async function renderD2Source(
  source: string,
  options: RenderD2SourceOptions = {},
): Promise<string> {
  const { pad = 20, scale = 1.15, salt } = options;
  const { D2 } = await import('@terrastruct/d2');
  const d2 = new D2();

  const result = await d2.compile({
    fs: {
      'index.d2': source,
    },
    inputPath: 'index.d2',
    options: {
      layout: 'elk',
      center: true,
      pad,
      scale,
      noXMLTag: true,
    },
  });

  return d2.render(result.diagram, {
    ...result.renderOptions,
    center: true,
    pad,
    scale,
    noXMLTag: true,
    salt,
  });
}
