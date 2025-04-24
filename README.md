## Grammar-Based Sampling in Simple Terms


1. 
You probably know by now that LLMs output a probability distribution over tokens. 
Sampling is the process of deciding which of these tokens to return given the model's output scores.


The simplest logical approach possible here is just to always take the token with the largest score.

(String chooser)                            completion

Sample String1                               c1                                            c2                  


                    [logits char 1]     [sampling (one-hot)]     [logits char 2]
        token0        model logit0          0                        ... 
        token1        model logit1          1 (yellow)      
        ...             ....                ...
        tokenN        model logitN          0


Or instead we could treat the scores as a distribution and sample from them. 
Typically softmax is first applied to turn our scores into a set a probabilities over our tokens which we can sample from


(String chooser)                                  completion
Sample String1                                   c1                                         c2                  

                    [logits char 1]      [sampling (prob. distribution)] [logits char 2]
        token0        model logit0         0 to 1                          ...
        token1        model logit1         0.001
        ...             ....               
        tokenN        model logitN         0.0001



As you crank up the temperature we essentially melt our greedy distribution down towards our softmax distribution 
or further if you want to end up with a more chaotic or even random sampling.

< Melting of greedy distribution to uniform >

2. There are several parameters which are usually exposed to users for controlling this sampling because it can have significant impact on outputs. Simple general parameters like temperature or 
more complex like different techniques which constrain how output is created.

Sampling Techniques
- XTC
- Microstat
- Penalities
- Top-n Sigma
- DRY
- Logit-Bias
- Temperature Extended

For implementation details take a look at llama.cpp 's code for sampling.
https://github.com/ggml-org/llama.cpp/blob/master/src/llama-sampling.cpp 


3. Constrained Sampling and Grammar-Based Sampling
----------------------------------------------------

What if we know we should be generating in a specific circumstance? For example what if we are asking a multiple choice question to a model 
with options A, B, C or D. It doesn't make sense to sample from everything a model could potentially spit out, we can *constrain* the sampling

For our multiple choice example we can constrain the sampling by removing everything except our valid choices as options.

< Insert simple probability masking >


This is straightforward, but limits what we can do with the model. What if we don't have a discrete set of choices, but instead we know the structure
of the outputs that could be generated. If we can express this desired output structure in a certain way, we can programmatically constrain the generations to match our intended output format. 


> Sidenote:
> Specifically if we can represent our language via a context-free grammar we can constrain our outputs using a Pushdown automata https://en.wikipedia.org/wiki/Pushdown_automaton#:~:text=(completely)%20read.-,Context%2Dfree%20languages,simulated%20in%20a%20leftmost%20way.  


Let's look at a simple example where we want to constrain outputs to a subset of valid JSON.





(String chooser)                                 completion
Sample String1                                                                     c1                                     c2                      

                    [logits char 1]      [Parse construction1]       [sampling(one-hot|distributino)]                    valid_parse(0..1)
        token0        model logit0              None                 (model logit0 * valid_parse(0..1))
        token1        model logit1              1
        ...             ....                   
        tokenN        model logitN              1





Important points:

1. Because of how tokenization works, we cannot easily enforce character by character rules. This is because if we expect a generation '{', '}' the tokenization scheme may have a dedicated token just for '{}' and by forcing first a '{' generation and then a separate '}' the model an get confused and the assumptions it has over time may break down.

2. Scanning the full set of possible tokens and checking for parse errors could be slow, we can instead focus on the highest-logit characters first and exit after some number of conformant tokens have been found 


For more detailed information on how this is done in practice look at the GBNF Guide in Llama.cpp https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md

## Interactive Visualizations

This repository also contains interactive visualizations to help illustrate the concepts discussed.

### Setup

1.  **Install Node.js and npm**: If you don't have them, download and install from [nodejs.org](https://nodejs.org/).
2.  **Install Dependencies**: Navigate to the project directory in your terminal and run:
    ```bash
    npm install
    ```

### Running the Visualizations

1.  **Start the Development Server**:
    ```bash
    npm start
    ```
    This will build the project, start a local web server, and automatically open the `index.html` page in your default web browser. The server will automatically reload the page when you make changes to the source files (`src/index.js` or `dist/index.html`).

2.  **View the Visualizations**: Interact with the visualizations in your browser.

### Building for Production

If you want to create a static build of the visualizations (e.g., for deployment):

```bash
npm run build
```

This will generate the bundled JavaScript and HTML files in the `dist` directory.
