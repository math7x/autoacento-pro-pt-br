let dicionario = null;
const cacheCorrecoes = {}; 

async function inicializarDicionario() {
    try {
        const affUrl = chrome.runtime.getURL('dicts/pt_BR.aff');
        const dicUrl = chrome.runtime.getURL('dicts/pt_BR.dic');
        
        const [affResposta, dicResposta] = await Promise.all([fetch(affUrl), fetch(dicUrl)]);
        const affDados = await affResposta.text();
        const dicDados = await dicResposta.text();
        
        dicionario = new Typo("pt_BR", affDados, dicDados);
        console.log("AutoAcento Pro: Dicionário carregado com sucesso!");
    } catch (erro) {
        console.error("Erro ao carregar o dicionário:", erro);
    }
}
inicializarDicionario();

function removerAcentos(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// NOVA FUNÇÃO: Coloca maiúscula no início da frase e após pontuação
function capitalizarTexto(texto) {
    return texto.replace(/(^\s*|[.!?]\s+)([a-zçáéíóúâêôãõàèìòù])/g, (match, separador, letra) => {
        return separador + letra.toUpperCase();
    });
}

document.addEventListener('keyup', (e) => {
    const elemento = e.target;
    
    const isTextInput = elemento.tagName === 'INPUT' && ['text', 'search'].includes(elemento.type);
    const isTextArea = elemento.tagName === 'TEXTAREA';
    const isContentEditable = elemento.isContentEditable;
    
    if (!isTextInput && !isTextArea && !isContentEditable) return;

    // --- 1. LÓGICA DE MAIÚSCULAS (Executa a cada letra digitada) ---
    if (isTextInput || isTextArea) {
        let textoAtual = elemento.value;
        let textoCap = capitalizarTexto(textoAtual);
        
        if (textoAtual !== textoCap) {
            let pos = elemento.selectionStart; // Salva o cursor
            elemento.value = textoCap;
            elemento.setSelectionRange(pos, pos); // Devolve o cursor pro lugar
        }
    } else if (isContentEditable) {
        const selecao = window.getSelection();
        if (selecao.rangeCount) {
            const range = selecao.getRangeAt(0);
            const nodeTexto = range.startContainer;
            
            if (nodeTexto.nodeType === Node.TEXT_NODE) {
                let textoAtual = nodeTexto.textContent;
                let textoCap = capitalizarTexto(textoAtual);
                
                if (textoAtual !== textoCap) {
                    let pos = range.startOffset; // Salva o cursor
                    nodeTexto.textContent = textoCap;
                    
                    // Devolve o cursor pro lugar exato
                    const novoRange = document.createRange();
                    const posicaoSegura = Math.min(pos, nodeTexto.textContent.length);
                    novoRange.setStart(nodeTexto, posicaoSegura);
                    novoRange.collapse(true);
                    selecao.removeAllRanges();
                    selecao.addRange(novoRange);
                }
            }
        }
    }

    // --- 2. LÓGICA DE ACENTUAÇÃO (Executa só ao apertar Espaço ou Pontuação) ---
    if (!dicionario) return;
    const gatilhos = [' ', '.', ',', '!', '?', ';', 'Enter'];
    
    if (gatilhos.includes(e.key)) {
        if (isTextInput || isTextArea) {
            let texto = elemento.value;
            let posicaoCursor = elemento.selectionStart;
            const textoAteCursor = texto.substring(0, posicaoCursor - 1);
            const palavras = textoAteCursor.split(/[\s\W]+/);
            const ultimaPalavra = palavras[palavras.length - 1];

            if (ultimaPalavra && ultimaPalavra.length > 1 && !dicionario.check(ultimaPalavra)) {
                let palavraCorrigida = cacheCorrecoes[ultimaPalavra];

                if (palavraCorrigida === undefined) {
                    const sugestoes = dicionario.suggest(ultimaPalavra);
                    palavraCorrigida = sugestoes.find(sugestao => removerAcentos(sugestao) === removerAcentos(ultimaPalavra));
                    cacheCorrecoes[ultimaPalavra] = palavraCorrigida || null;
                }

                if (palavraCorrigida) {
                    const inicioTexto = texto.substring(0, posicaoCursor - 1 - ultimaPalavra.length);
                    const fimTexto = texto.substring(posicaoCursor - 1);
                    elemento.value = inicioTexto + palavraCorrigida + fimTexto;
                    const diferencaTamanho = palavraCorrigida.length - ultimaPalavra.length;
                    elemento.setSelectionRange(posicaoCursor + diferencaTamanho, posicaoCursor + diferencaTamanho);
                }
            }
        } else if (isContentEditable) {
            const selecao = window.getSelection();
            if (!selecao.rangeCount) return;

            const range = selecao.getRangeAt(0);
            const nodeTexto = range.startContainer;

            if (nodeTexto.nodeType === Node.TEXT_NODE) {
                const posicaoCursor = range.startOffset;
                const texto = nodeTexto.textContent;
                
                const textoAteCursor = texto.substring(0, posicaoCursor - 1);
                const palavras = textoAteCursor.split(/[\s\W]+/);
                const ultimaPalavra = palavras[palavras.length - 1];

                if (ultimaPalavra && ultimaPalavra.length > 1 && !dicionario.check(ultimaPalavra)) {
                    
                    let palavraCorrigida = cacheCorrecoes[ultimaPalavra];

                    if (palavraCorrigida === undefined) {
                        const sugestoes = dicionario.suggest(ultimaPalavra);
                        palavraCorrigida = sugestoes.find(sugestao => removerAcentos(sugestao) === removerAcentos(ultimaPalavra));
                        cacheCorrecoes[ultimaPalavra] = palavraCorrigida || null;
                    }
                    
                    if (palavraCorrigida) {
                        const inicioTexto = texto.substring(0, posicaoCursor - 1 - ultimaPalavra.length);
                        const fimTexto = texto.substring(posicaoCursor - 1);
                        nodeTexto.textContent = inicioTexto + palavraCorrigida + fimTexto;

                        const novoRange = document.createRange();
                        const novaPosicao = inicioTexto.length + palavraCorrigida.length + 1;
                        const posicaoSegura = Math.min(novaPosicao, nodeTexto.textContent.length);
                        
                        novoRange.setStart(nodeTexto, posicaoSegura);
                        novoRange.collapse(true);
                        selecao.removeAllRanges();
                        selecao.addRange(novoRange);
                    }
                }
            }
        }
    }
});