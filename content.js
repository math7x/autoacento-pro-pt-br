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
        console.log("AutoAcento Digisac: Dicionário carregado com sucesso!");
    } catch (erro) {
        console.error("Erro ao carregar o dicionário:", erro);
    }
}
inicializarDicionario();

function removerAcentos(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function capitalizarTexto(texto) {
    return texto.replace(/(^\s*|[.!?]\s+)([a-zçáéíóúâêôãõàèìòù])/g, (match, separador, letra, offset, string) => {
        const restante = string.substring(offset + separador.length); 
        if (restante.match(/^(https?:\/\/|www\.|[a-zA-Z0-9-]+\.[a-zA-Z]{2,})/i)) {
            return match;
        }
        return separador + letra.toUpperCase();
    });
}

document.addEventListener('keyup', (e) => {
    if (e.ctrlKey || e.metaKey) return;
    const elemento = e.target;
    const isTextInput = elemento.tagName === 'INPUT' && ['text', 'search'].includes(elemento.type);
    const isTextArea = elemento.tagName === 'TEXTAREA';
    const isContentEditable = elemento.isContentEditable;
    
    if (!isTextInput && !isTextArea && !isContentEditable) return;

    if (isTextInput || isTextArea) {
        let textoAtual = elemento.value;
        let textoCap = capitalizarTexto(textoAtual);
        if (textoAtual !== textoCap) {
            let pos = elemento.selectionStart;
            elemento.value = textoCap;
            elemento.setSelectionRange(pos, pos);
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
                    let pos = range.startOffset; 
                    nodeTexto.textContent = textoCap;
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

    if (!dicionario) return;
    const gatilhos = [' ', '.', ',', '!', '?', ';', 'Enter'];
    
    if (gatilhos.includes(e.key)) {
        if (isTextInput || isTextArea) {
            let texto = elemento.value;
            let posicaoCursor = elemento.selectionStart;
            const textoAteCursor = texto.substring(0, posicaoCursor - 1);
            
            const blocos = textoAteCursor.split(/\s+/);
            const ultimoBloco = blocos[blocos.length - 1];
            if (ultimoBloco && ultimoBloco.match(/(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,})/i)) {
                return; 
            }

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
                
                const blocos = textoAteCursor.split(/\s+/);
                const ultimoBloco = blocos[blocos.length - 1];
                if (ultimoBloco && ultimoBloco.match(/(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,})/i)) {
                    return; 
                }

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