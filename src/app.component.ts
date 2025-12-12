
import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService, LearningMode } from './services/gemini.service';

interface LearningModeItem {
  mode: LearningMode;
  description: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnDestroy, OnInit {
  private readonly geminiService = inject(GeminiService);
  readonly speechSynthesisSupported = 'speechSynthesis' in window;

  // Hold a reference to the utterance to prevent premature garbage collection
  private utterance: SpeechSynthesisUtterance | null = null;

  learningModes: LearningModeItem[] = [
    { mode: 'ADHD-friendly', description: 'Breaks text into small, focused chunks with clear, actionable steps.' },
    { mode: 'Dyslexia-friendly', description: 'Uses simple language, short sentences, and improved readability.' },
    { mode: 'Visual learner', description: 'Organizes information with structures like lists, tables, or text-based mind maps.' },
    { mode: 'Audio learner', description: 'Formats text in a conversational, spoken style, like a podcast script.' },
    { mode: 'Example-based learner', description: 'Explains concepts using real-world analogies and concrete examples.' },
    { mode: 'Mixed mode', description: 'A balanced blend of multiple styles for comprehensive understanding.' },
  ];

  // Signals for state management
  inputText = signal<string>('The water cycle, also known as the hydrologic cycle, is the continuous movement of water on, above, and below the surface of the Earth. Water can change states among liquid, vapor (gas), and ice (solid) at various places in the water cycle. The main processes are evaporation, transpiration, condensation, precipitation, and collection. Evaporation is when the sun heats up water in rivers, lakes or the ocean and turns it into vapor or steam. Transpiration is the process by which moisture is carried through plants from roots to small pores on the underside of leaves, where it changes to vapor and is released to the atmosphere. Condensation is when water vapor in the air gets cold and changes back into liquid, forming clouds. Precipitation occurs when so much water has condensed that the air cannot hold it anymore. The clouds get heavy and water falls back to the Earth in the form of rain, hail, sleet or snow.');
  selectedMode = signal<LearningMode>(this.learningModes[0].mode);
  transformedContent = signal<string>('');
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);
  isCopied = signal<boolean>(false);

  // Signals for Text-to-Speech
  isSpeaking = signal<boolean>(false);
  isPaused = signal<boolean>(false);
  availableVoices = signal<SpeechSynthesisVoice[]>([]);
  selectedVoice = signal<SpeechSynthesisVoice | null>(null);

  ngOnInit(): void {
    if (this.speechSynthesisSupported) {
      // Voices are often loaded asynchronously. We listen for the 'voiceschanged' event.
      this.loadVoices(); // Initial attempt
      window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }
  }

  ngOnDestroy(): void {
    // Clean up speech synthesis on component destruction
    if (this.isSpeaking()) {
      this.stopSpeech();
    }
    // Remove event listener
    if (this.speechSynthesisSupported) {
      window.speechSynthesis.onvoiceschanged = null;
    }
  }

  loadVoices(): void {
    const voices = window.speechSynthesis.getVoices();
    this.availableVoices.set(voices);

    const currentSelectedURI = this.selectedVoice()?.voiceURI;
    const previouslySelectedVoice = voices.find(v => v.voiceURI === currentSelectedURI);

    if (previouslySelectedVoice) {
      this.selectedVoice.set(previouslySelectedVoice);
    } else if (voices.length > 0) {
      // Set a default voice if none was selected or the selected one disappeared.
      const defaultVoice = voices.find(v => v.lang.startsWith('en') && v.default) || voices.find(v => v.lang.startsWith('en')) || voices[0];
      this.selectedVoice.set(defaultVoice);
    }
  }

  selectMode(mode: LearningMode): void {
    this.selectedMode.set(mode);
  }

  async transformContent(): Promise<void> {
    if (!this.inputText() || this.isLoading()) {
      return;
    }

    // Stop any ongoing speech before generating new content
    if (this.isSpeaking()) {
      this.stopSpeech();
    }

    this.isLoading.set(true);
    this.error.set(null);
    this.transformedContent.set('');

    // The language of the adapted text is determined by the selected voice.
    const targetLanguage = this.selectedVoice()?.lang;

    try {
      const result = await this.geminiService.transformContent(
        this.inputText(),
        this.selectedMode(),
        targetLanguage
      );
      this.transformedContent.set(result);
    } catch (e) {
      console.error('Error transforming content:', e);
      this.error.set('Sorry, something went wrong. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  handleTextAreaInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    this.inputText.set(target.value);
  }

  clearText(): void {
    this.inputText.set('');
  }

  copyContent(): void {
    if (!this.transformedContent()) {
      return;
    }
    navigator.clipboard.writeText(this.transformedContent()).then(() => {
      this.isCopied.set(true);
      setTimeout(() => this.isCopied.set(false), 2000);
    }).catch(err => console.error('Failed to copy text: ', err));
  }

  // --- Text-to-Speech Methods ---

  selectVoice(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const voiceURI = selectElement.value;
    const voice = this.availableVoices().find(v => v.voiceURI === voiceURI);
    if (voice) {
      const previousVoice = this.selectedVoice();
      this.selectedVoice.set(voice);

      // If content is already adapted and the language has changed, re-transform.
      if (
        this.transformedContent() &&
        !this.isLoading() &&
        previousVoice?.lang !== voice.lang
      ) {
        this.transformContent();
      }
    }
  }

  handleReadAloud(): void {
    if (!this.speechSynthesisSupported) return;

    if (this.isSpeaking() && !this.isPaused()) {
      // Is speaking, so pause
      window.speechSynthesis.pause();
      this.isPaused.set(true);
    } else if (this.isSpeaking() && this.isPaused()) {
      // Is paused, so resume
      window.speechSynthesis.resume();
      this.isPaused.set(false);
    } else {
      // Is not speaking, so start
      this.utterance = new SpeechSynthesisUtterance(this.transformedContent());
      if (this.selectedVoice()) {
        this.utterance.voice = this.selectedVoice();
        this.utterance.lang = this.selectedVoice()!.lang; // Explicitly set lang for better compatibility
      }

      this.utterance.onend = () => {
        this.isSpeaking.set(false);
        this.isPaused.set(false);
        this.utterance = null;
      };
      this.utterance.onerror = (event) => {
        // The 'interrupted' error is expected when we intentionally stop speech.
        // We only log other, unexpected errors.
        if (event.error !== 'interrupted') {
          console.error('SpeechSynthesis Error:', event.error);
        }
        this.isSpeaking.set(false);
        this.isPaused.set(false);
        this.utterance = null;
      };
      
      window.speechSynthesis.cancel(); // Clear any previous utterances
      window.speechSynthesis.speak(this.utterance);
      this.isSpeaking.set(true);
      this.isPaused.set(false);
    }
  }

  stopSpeech(): void {
    if (!this.speechSynthesisSupported) return;
    
    window.speechSynthesis.cancel();
    this.isSpeaking.set(false);
    this.isPaused.set(false);
    this.utterance = null;
  }
}
