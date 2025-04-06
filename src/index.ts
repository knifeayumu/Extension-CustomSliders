import yaml from 'yaml';
import './style.css';
import settingsTemplate from './settings.html';
import configTemplate from './config.html';
import sliderTemplate from './slider.html';

const { saveSettingsDebounced, event_types, eventSource, chatCompletionSettings } = SillyTavern.getContext();

const MODULE_NAME = 'customSliders';

interface ChatCompletionRequestData {
    chat_completion_source: string;
    custom_include_body: string;
}

interface SliderModel {
    name: string;
    property: string;
    min: string;
    max: string;
    step: string;
    value: number;
}

interface ExtensionSettings {
    sliders: SliderModel[];
    // Allow additional properties
    [key: string]: unknown;
}

interface GlobalSettings {
    [MODULE_NAME]: ExtensionSettings;
}

const defaultSettings: Readonly<ExtensionSettings> = Object.freeze({
    sliders: [],
});

export function getSettings(): ExtensionSettings {
    const context = SillyTavern.getContext();
    const globalSettings = context.extensionSettings as object as GlobalSettings;

    // Initialize settings if they don't exist
    if (!globalSettings[MODULE_NAME]) {
        globalSettings[MODULE_NAME] = structuredClone(defaultSettings);
    }

    // Ensure all default keys exist (helpful after updates)
    for (const key in defaultSettings) {
        if (globalSettings[MODULE_NAME][key] === undefined) {
            globalSettings[MODULE_NAME][key] = defaultSettings[key];
        }
    }

    return globalSettings[MODULE_NAME];
}

function getUIElements() {
    return {
        create: document.getElementById('custom_sliders_create') as HTMLInputElement,
        list: document.getElementById('custom_sliders_list') as HTMLDivElement,
        rangeBlock: document.getElementById('range_block_openai') as HTMLDivElement,
    };
}

export function addSettingsControls(settings: ExtensionSettings): void {
    const settingsContainer = document.getElementById('custom_sliders_container') ?? document.getElementById('extensions_settings');
    if (!settingsContainer) {
        return;
    }

    const renderer = document.createElement('template');
    renderer.innerHTML = settingsTemplate;

    settingsContainer.appendChild(renderer.content);

    const elements = getUIElements();
    elements.create.addEventListener('click', createSlider);
}

function createSlider(): void {
    const settings = getSettings();
    settings.sliders.unshift({
        name: 'New Slider',
        property: '',
        min: '0',
        max: '1',
        step: '0.01',
        value: 0,
    });

    renderSliderConfigs(settings);
}

function renderSliderConfigs(settings: ExtensionSettings): void {
    const elements = getUIElements();

    elements.list.innerHTML = '';
    settings.sliders.forEach((slider, index) => {
        const renderer = document.createElement('template');
        renderer.innerHTML = configTemplate;

        const nameInput = renderer.content.querySelector('input[name="name"]') as HTMLInputElement;
        const propertyInput = renderer.content.querySelector('input[name="property"]') as HTMLInputElement;
        const minInput = renderer.content.querySelector('input[name="min"]') as HTMLInputElement;
        const maxInput = renderer.content.querySelector('input[name="max"]') as HTMLInputElement;
        const stepInput = renderer.content.querySelector('input[name="step"]') as HTMLInputElement;

        const deleteButton = renderer.content.querySelector('button[name="delete"]') as HTMLButtonElement;
        const upButton = renderer.content.querySelector('button[name="up"]') as HTMLButtonElement;
        const downButton = renderer.content.querySelector('button[name="down"]') as HTMLButtonElement;

        nameInput.value = slider.name;
        propertyInput.value = slider.property;
        minInput.value = slider.min;
        maxInput.value = slider.max;
        stepInput.value = slider.step;

        nameInput.addEventListener('input', (e) => {
            slider.name = nameInput.value;
            renderCompletionSliders(settings);
            saveSettingsDebounced();
        });

        propertyInput.addEventListener('input', (e) => {
            slider.property = propertyInput.value;
            renderCompletionSliders(settings);
            saveSettingsDebounced();
        });

        minInput.addEventListener('input', (e) => {
            slider.min = minInput.value;
            renderCompletionSliders(settings);
            saveSettingsDebounced();
        });

        maxInput.addEventListener('input', (e) => {
            slider.max = maxInput.value;
            renderCompletionSliders(settings);
            saveSettingsDebounced();
        });

        stepInput.addEventListener('input', (e) => {
            slider.step = stepInput.value;
            renderCompletionSliders(settings);
            saveSettingsDebounced();
        });

        deleteButton.addEventListener('click', () => {
            if (!confirm('Are you sure?')) {
                return;
            }

            settings.sliders.splice(index, 1);
            renderSliderConfigs(settings);
            saveSettingsDebounced();
        });

        upButton.addEventListener('click', () => {
            if (index > 0) {
                const temp = settings.sliders[index - 1];
                settings.sliders[index - 1] = settings.sliders[index];
                settings.sliders[index] = temp;
                renderSliderConfigs(settings);
                saveSettingsDebounced();
            }
        });

        downButton.addEventListener('click', () => {
            if (index < settings.sliders.length - 1) {
                const temp = settings.sliders[index + 1];
                settings.sliders[index + 1] = settings.sliders[index];
                settings.sliders[index] = temp;
                renderSliderConfigs(settings);
                saveSettingsDebounced();
            }
        });

        elements.list.appendChild(renderer.content);
        elements.list.appendChild(document.createElement('hr'));
    });

    renderCompletionSliders(settings);
}

function renderCompletionSliders(settings: ExtensionSettings): void {
    const elements = getUIElements();

    let container = elements.rangeBlock.querySelector('.custom_sliders_container');

    if (!container) {
        container = document.createElement('div');
        container.classList.add('custom_sliders_container');

        const referenceElement = Array.from(elements.rangeBlock.querySelectorAll('.range-block:has(input[type="range"])')).pop();
        if (!referenceElement) {
            return;
        }

        referenceElement.insertAdjacentElement('afterend', container);
    }

    container.innerHTML = '';
    settings.sliders.forEach((slider) => {
        if (!slider.property || !slider.name || !slider.min || !slider.max || !slider.step) {
            return;
        }

        if (!slider.value) {
            slider.value = parseFloat(slider.min);
        }

        if (slider.value < parseFloat(slider.min)) {
            slider.value = parseFloat(slider.min);
        }

        if (slider.value > parseFloat(slider.max)) {
            slider.value = parseFloat(slider.max);
        }

        const renderer = document.createElement('template');
        renderer.innerHTML = sliderTemplate;

        const sliderId = CSS.escape('custom_slider_' + slider.property);
        const rangeBlock = renderer.content.querySelector('.range-block') as HTMLDivElement;
        const titleElement = renderer.content.querySelector('.range-block-title') as HTMLSpanElement;
        const sliderInput = renderer.content.querySelector('input[type="range"]') as HTMLInputElement;
        const numberInput = renderer.content.querySelector('input[type="number"]') as HTMLInputElement;

        const existingSlider = document.getElementById(sliderId);
        if (existingSlider) {
            toastr.warning('Duplicate slider property name: ' + slider.property);
            return;
        }

        titleElement.textContent = slider.name;
        sliderInput.id = sliderId;
        sliderInput.min = slider.min;
        sliderInput.max = slider.max;
        sliderInput.step = slider.step;
        sliderInput.value = slider.value.toString();

        numberInput.id = sliderId + '_number';
        numberInput.min = slider.min;
        numberInput.max = slider.max;
        numberInput.step = slider.step;
        numberInput.value = slider.value.toString();
        numberInput.dataset.for = sliderId;

        sliderInput.addEventListener('input', (e) => {
            slider.value = parseFloat(sliderInput.value);
            numberInput.value = sliderInput.value;
            saveSettingsDebounced();
        });

        if (chatCompletionSettings.source !== 'custom') {
            rangeBlock.style.display = 'none';
        }

        container.appendChild(renderer.content);
    });
}

function mergeYamlIntoObject(obj: object, yamlString: string) {
    if (!yamlString) {
        return obj;
    }

    try {
        const parsedObject = yaml.parse(yamlString);

        if (Array.isArray(parsedObject)) {
            for (const item of parsedObject) {
                if (typeof item === 'object' && item && !Array.isArray(item)) {
                    Object.assign(obj, item);
                }
            }
        }
        else if (parsedObject && typeof parsedObject === 'object') {
            Object.assign(obj, parsedObject);
        }
    } catch {
        // Do nothing
    }

    return obj;
}


function setupEventHandlers(settings: ExtensionSettings): void {
    eventSource.on(event_types.CHAT_COMPLETION_SETTINGS_READY, (data: ChatCompletionRequestData) => {
        if (data.chat_completion_source !== 'custom') {
            return;
        }

        const customBody = mergeYamlIntoObject({}, data.custom_include_body);
        const sliders = settings.sliders.reduce((acc, slider) => {
            if (slider.property && !isNaN(slider.value)) {
                acc[slider.property] = slider.value;
            }
            return acc;
        }, {} as Record<string, number>);
        Object.assign(customBody, sliders);
        data.custom_include_body = yaml.stringify(customBody);
    });
}

(async function init() {
    const settings = getSettings();
    addSettingsControls(settings);
    renderSliderConfigs(settings);
    setupEventHandlers(settings);
    saveSettingsDebounced();
})();
