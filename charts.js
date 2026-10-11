/* All chart specifications remain in their original .vg.json files. */
const actionToggle = document.querySelector('#show-actions');
const statusMessage = document.querySelector('#page-status');
const preferenceKey = 'wildlife-show-chart-actions';
const linkedViews = [];
let highlightedSpecies = null;
let speciesUpdates = Promise.resolve();

const linkedCharts = {
  'DotMap.vg.json': {},
  'Lollipop.vg.json': { events: '@stems:click, @dots:click, @counts:click', data: ['topSpecies'] },
  'BumpChart.vg.json': { events: '@trajectories:click, @points:click, @speciesLabels:click', data: ['series', 'ranked', 'endpoints', 'highlight'] },
  'Streamgraph.vg.json': { data: ['seriesData', 'focusedCounts', 'legendEntries'] },
  'Ridgeline.vg.json': { data: ['ridge', 'monthly', 'species'] },
  'Waffle.vg.json': { events: '@speciesLabels:click, @speciesShares:click', data: ['topSpecies'] },
  'Sankey.vg.json': { events: '@nodes:click, @labels:click, @ribbons:click', data: ['links', 'nodeData'] },
  'Sunburst.vg.json': { events: '@segments:click, @childLabels:click', data: ['visible', 'children'] }
};

// Add website-wide selection to the embedded specs without changing their data.
function linkSpecies(spec, file) {
  if (spec.title && typeof spec.title === 'object') {
    spec.title.anchor = 'middle';
    spec.title.align = 'center';
    if (spec.title.subtitle) {
      spec.title.subtitle = [spec.title.subtitle].flat().flatMap(line =>
        String(line).split(/(?<=[.!?])\s+(?=[A-Z])/)
      );
    }
  }
  if (file === 'ChoroplethMap.vg.json') {
    // Also suppress the summary if an older copy of the spec is loaded.
    spec.marks = spec.marks.filter(mark => mark.name !== 'monthHeading');
    // Reserve a row for the HTML controls between the map and monthly charts.
    for (const mark of spec.marks) {
      const y = mark.encode?.update?.y;
      if (typeof y?.value === 'number' && y.value >= 470) y.value += 42;
    }
    spec.height += 42;
  }
  const config = linkedCharts[file];
  if (!config) return spec;
  spec.signals ??= [];
  let selected = spec.signals.find(signal => signal.name === 'selectedSpecies');
  if (!selected) {
    let species = 'datum.species';
    if (file === 'Sankey.vg.json') species = "datum.species || (datum.column === 0 ? datum.name : null)";
    if (file === 'Sunburst.vg.json') species = "datum.level === 'Species' ? datum.label : null";
    selected = {
      name: 'selectedSpecies', value: null,
      on: [{ events: config.events, update: `(${species}) ? (selectedSpecies === (${species}) ? null : (${species})) : selectedSpecies` }]
    };
    if (file === 'Sankey.vg.json') selected.on.push({ events: '@reset:click', update: 'null' });
    selected.on.push({ events: "window:keydown[event.key === 'Escape']", update: 'null' });
    spec.signals.push(selected);
  }

  const active = spec.signals.find(signal => signal.name === 'activeSpecies');
  if (active) active.update = 'selectedSpecies != null ? selectedSpecies : hoveredSpecies';
  if (file === 'Sankey.vg.json') {
    spec.signals.find(signal => signal.name === 'active').update = "selectedSpecies ? 'species:' + selectedSpecies : selected || hovered";
    // Species use the shared selection; state selections remain local to this chart.
    spec.signals.find(signal => signal.name === 'selected').on[0].update = 'datum.column === 1 ? (selected === datum.key ? null : datum.key) : null';
  }
  if (file === 'BumpChart.vg.json') {
    spec.data.push({ name: 'selectedAnnual', source: 'annualCounts', transform: [{ type: 'filter', expr: 'datum.species === selectedSpecies' }] });
    spec.signals.push({ name: 'activeScientific', update: "length(data('selectedAnnual')) ? data('selectedAnnual')[0].scientific_name : hoveredSpecies" });
  }

  if (file === 'Sunburst.vg.json') {
    spec.data.push({ name: 'selectedNode', source: 'taxonomy', transform: [{ type: 'filter', expr: "datum.level === 'Species' && datum.label === selectedSpecies" }] });
  }

  function patchMarks(marks) {
    for (const mark of marks || []) {
      if (config.data?.includes(mark.from?.data)) {
        let matches = 'datum.species === selectedSpecies';
        if (file === 'Sankey.vg.json') matches = "indexof(datum.keys, 'species:' + selectedSpecies) >= 0";
        if (file === 'Sunburst.vg.json') matches = "length(data('selectedNode')) && (datum.id === data('selectedNode')[0].id || datum.id === data('selectedNode')[0].parent || datum.id === data('selectedNode')[0].group)";
        const update = mark.encode.update ??= {};
        if (file === 'BumpChart.vg.json') {
          for (const encoding of Object.values(update)) {
            if (encoding.signal) encoding.signal = encoding.signal.replaceAll('hoveredSpecies', 'activeScientific');
          }
        }
        const opacity = update.opacity;
        const base = opacity?.signal ?? opacity?.value ?? 1;
        update.opacity = { signal: `(${base}) * (selectedSpecies == null || (${matches}) ? 1 : 0.16)` };
        // Labels double as click targets, even in charts that previously only hovered.
        if (mark.name && config.events?.includes(`@${mark.name}:click`)) update.cursor = { value: 'pointer' };
      }
      patchMarks(mark.marks);
    }
  }
  patchMarks(spec.marks);
  return spec;
}

function positionMapControls(chart) {
  const wrapper = chart.querySelector('.chart-wrapper');
  const bindings = chart.querySelector('.vega-bindings');
  const frame = wrapper?.querySelector('.mapFrame');
  if (!wrapper || !bindings || !frame) return;
  const controls = document.createElement('div');
  controls.className = 'choropleth-controls';
  controls.setAttribute('aria-label', 'Map location and zoom controls');
  controls.append(bindings);
  wrapper.append(controls);
  const position = () => {
    const map = frame.getBoundingClientRect();
    const box = wrapper.getBoundingClientRect();
    controls.style.top = `${map.bottom - box.top + 30}px`;
    controls.style.left = `${map.left - box.left}px`;
    controls.style.width = `${map.width}px`;
  };
  position();
  const observer = new ResizeObserver(position);
  observer.observe(wrapper);
}

function selectSpecies(species) {
  highlightedSpecies = species;
  updateSpeciesLegend();
  document.querySelector('#species-highlight').textContent = species ? `Species highlight: ${species}` : 'Species highlight: All species';
  document.querySelector('#clear-species').hidden = species == null;
  // Queue updates outside signal listeners, so the originating Vega pulse finishes first.
  speciesUpdates = speciesUpdates.then(async () => {
    for (const { view, speciesNames } of linkedViews) {
      const value = speciesNames.has(highlightedSpecies) ? highlightedSpecies : null;
      if (view.signal('selectedSpecies') !== value) {
        await view.signal('selectedSpecies', value).runAsync();
      }
    }
  }).catch(error => console.error('Could not synchronize species highlights', error));
}

function updateSpeciesLegend() {
  document.querySelectorAll('.species-button').forEach(button => {
    const selected = button.dataset.species === highlightedSpecies;
    button.setAttribute('aria-pressed', String(selected));
    button.classList.toggle('is-muted', highlightedSpecies != null && !selected);
  });
  document.querySelector('#show-all-species').setAttribute('aria-pressed', String(highlightedSpecies == null));
}

function renderSpeciesLegend(spec) {
  const entries = spec.data.find(dataset => dataset.name === 'speciesLegendEntries').values;
  const scale = spec.scales.find(scale => scale.name === 'speciesColor');
  const container = document.querySelector('#species-legend-buttons');
  container.replaceChildren();
  for (const { species } of entries) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'species-button';
    button.dataset.species = species;
    const swatch = document.createElement('span');
    swatch.className = 'species-swatch';
    swatch.setAttribute('aria-hidden', 'true');
    swatch.style.backgroundColor = scale.range[scale.domain.indexOf(species)];
    button.append(swatch, document.createTextNode(species));
    button.addEventListener('click', () => selectSpecies(highlightedSpecies === species ? null : species));
    container.append(button);
  }
  updateSpeciesLegend();
}

document.querySelector('#show-all-species').addEventListener('click', () => selectSpecies(null));

document.querySelector('#clear-species').addEventListener('click', () => selectSpecies(null));

try {
  actionToggle.checked = localStorage.getItem(preferenceKey) !== 'false';
} catch {
  // The toggle also works when browser storage is unavailable.
}

function updateActionVisibility() {
  document.body.classList.toggle('hide-chart-actions', !actionToggle.checked);
  if (!actionToggle.checked) {
    document.querySelectorAll('.vega-embed > details[open]').forEach(menu => {
      menu.open = false;
    });
  }
}

updateActionVisibility();
actionToggle.addEventListener('change', () => {
  updateActionVisibility();
  try {
    localStorage.setItem(preferenceKey, String(actionToggle.checked));
  } catch {
    // Saving a preference is optional; chart interaction remains available.
  }
});

async function loadCharts() {
  const charts = [...document.querySelectorAll('[data-spec]')];
  if (location.protocol === 'file:') {
    statusMessage.textContent = 'Open this page using VS Code Live Server or run python3 -m http.server 8000 and visit http://localhost:8000. Chart files need an HTTP server.';
    return;
  }
  if (typeof vegaEmbed !== 'function') {
    statusMessage.textContent = 'The chart library could not load. Check your internet connection and refresh the page.';
    return;
  }

  let loaded = 0;
  let failed = 0;
  for (const chart of charts) {
    const file = chart.dataset.spec;
    try {
      const response = await fetch(file, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Could not fetch ${file}: ${response.status}`);
      const spec = await response.json();
      if (file === 'DotMap.vg.json') renderSpeciesLegend(spec);
      const result = await vegaEmbed(chart, spec, {
        mode: 'vega',
        renderer: 'svg',
        actions: { export: { svg: true, png: true }, source: true, editor: true },
        editorUrl: 'https://vega.github.io/editor/',
        downloadFileName: file.replace('.vg.json', ''),
        defaultStyle: true,
        patch: spec => linkSpecies(spec, file)
      });
      if (file === 'ChoroplethMap.vg.json') positionMapControls(chart);
      if (linkedCharts[file]) {
        const speciesNames = new Set();
        for (const dataset of result.spec.data || []) {
          for (const row of dataset.values || []) {
            if (row.species) speciesNames.add(row.species);
            if (row.level === 'Species') speciesNames.add(row.label || row.name);
          }
        }
        const view = result.view;
        linkedViews.push({ view, speciesNames });
        // Apply earlier selections to charts that finish loading later.
        await view.signal('selectedSpecies', speciesNames.has(highlightedSpecies) ? highlightedSpecies : null).runAsync();
        view.addSignalListener('selectedSpecies', (_, value) => {
          const expected = speciesNames.has(highlightedSpecies) ? highlightedSpecies : null;
          if (value !== expected) selectSpecies(value);
        });
      }
      const summary = chart.querySelector('summary');
      if (summary) {
        summary.setAttribute('aria-label', `Chart actions for ${chart.getAttribute('aria-label')}`);
        summary.title = 'Click to view actions';
      }
      loaded++;
    } catch (error) {
      failed++;
      chart.replaceChildren();
      const message = document.createElement('p');
      message.className = 'chart-error';
      message.textContent = `Could not load ${file}. Refresh the page to try again.`;
      chart.append(message);
      console.error(`Could not render ${file}`, error);
    }
    statusMessage.textContent = `Loaded ${loaded} of ${charts.length} charts${failed ? ` · ${failed} could not load` : '…'}`;
  }
  statusMessage.textContent = failed
    ? `Loaded ${loaded} of ${charts.length} charts · ${failed} could not load. See the affected chart for details.`
    : '';
  statusMessage.hidden = failed === 0;
}

loadCharts();
