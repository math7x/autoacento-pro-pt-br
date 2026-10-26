function prepararCorretor() {
    chrome.runtime.sendMessage({ type: 'spell-warm' }, () => {
        // A consulta é apenas um pré-carregamento; a correção informa erros ao usuário no momento de uso.
        void chrome.runtime.lastError;
    });
}

function palavraEhLink(texto) {
    const bloco = texto.split(/\s+/).at(-1) || '';
    return /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,})/i.test(bloco);
}

function solicitarCorrecao(palavra, aplicar) {
    if (palavra.length < 2 || palavraEhLink(palavra)) return;
    chrome.runtime.sendMessage({ type: 'spell-check', word: palavra }, (resposta) => {
        if (chrome.runtime.lastError) {
            console.warn('AutoAcento: não foi possível consultar o dicionário.', chrome.runtime.lastError.message);
            return;
        }
        if (resposta?.corrected) aplicar(resposta.corrected);
    });
}

document.addEventListener('focusin', (evento) => {
    const elemento = evento.target;
    if (elemento instanceof HTMLElement && (
        (elemento.tagName === 'INPUT' && ['text', 'search'].includes(elemento.type)) ||
        elemento.tagName === 'TEXTAREA' || elemento.isContentEditable
    )) {
        prepararCorretor();
    }
}, true);

function capitalizarTexto(texto) {
    return texto.replace(/(^\s*|[.!?]\s+)([a-zçáéíóúâêôãõàèìòù])/g, (match, separador, letra, offset, string) => {
        const restante = string.substring(offset + separador.length);
        if (/^(https?:\/\/|www\.|[a-zA-Z0-9-]+\.[a-zA-Z]{2,})/i.test(restante)) return match;
        return separador + letra.toUpperCase();
    });
}

function inserirInicialMaiuscula(evento) {
    const elemento = evento.target;
    const letra = evento.key;
    if (evento.ctrlKey || evento.metaKey || evento.altKey || letra.length !== 1 ||
        !/[a-záéíóúâêôãõàèìòùç]/i.test(letra) || letra !== letra.toLowerCase()) return;

    const campo = elemento instanceof HTMLInputElement && ['text', 'search'].includes(elemento.type)
        ? elemento
        : elemento instanceof HTMLTextAreaElement ? elemento : null;

    if (campo) {
        const cursor = campo.selectionStart;
        const textoAntes = campo.value.slice(0, cursor);
        if (textoAntes.trim() !== '' && !/[.!?]\s+$/.test(textoAntes)) return;
        evento.preventDefault();
        campo.setRangeText(letra.toUpperCase(), cursor, campo.selectionEnd, 'end');
        campo.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            inputType: 'insertText',
            data: letra.toUpperCase()
        }));
        return;
    }

    if (!(elemento instanceof HTMLElement) || !elemento.isContentEditable ||
        !document.queryCommandSupported('insertText')) return;
    const selecao = window.getSelection();
    if (!selecao?.rangeCount) return;
    const rangeCursor = selecao.getRangeAt(0);
    const editor = elemento.closest('[contenteditable]') || elemento;
    const antes = document.createRange();
    antes.selectNodeContents(editor);
    try {
        antes.setEnd(rangeCursor.startContainer, rangeCursor.startOffset);
    } catch {
        return;
    }
    const textoAntes = antes.toString();
    if (textoAntes.trim() !== '' && !/[.!?]\s+$/.test(textoAntes)) return;

    evento.preventDefault();
    document.execCommand('insertText', false, letra.toUpperCase());
}

document.addEventListener('keydown', inserirInicialMaiuscula, true);

function abrirImagemAnexoEmNovaGuia(evento) {
    if (location.hostname !== 'cdn.octadesk.com' ||
        !location.pathname.startsWith('/old-widget-static/')) return;

    const alvo = evento.target;
    if (!(alvo instanceof Element)) return;
    const link = alvo.closest('a[download]');
    if (!link || !link.querySelector('img')) return;

    let endereco;
    try {
        endereco = new URL(link.href);
    } catch {
        return;
    }
    if (endereco.hostname !== 'storage.googleapis.com' ||
        !endereco.pathname.startsWith('/octa-static-tenants/') ||
        !/\.(png|jpe?g|gif|webp)$/i.test(endereco.pathname)) return;

    evento.preventDefault();
    evento.stopImmediatePropagation();
    window.open(endereco.href, '_blank', 'noopener');
}

document.addEventListener('click', abrirImagemAnexoEmNovaGuia, true);

document.addEventListener('input', (evento) => {
    const elemento = evento.target;
    const campoTexto = elemento instanceof HTMLInputElement && ['text', 'search'].includes(elemento.type);
    const areaTexto = elemento instanceof HTMLTextAreaElement;
    if ((campoTexto || areaTexto) && typeof elemento.selectionStart === 'number') {
        const textoCapitalizado = capitalizarTexto(elemento.value);
        if (textoCapitalizado !== elemento.value) {
            const inicioSelecao = elemento.selectionStart;
            const fimSelecao = elemento.selectionEnd;
            elemento.value = textoCapitalizado;
            elemento.setSelectionRange(inicioSelecao, fimSelecao);
        }
    } else if (elemento instanceof HTMLElement && elemento.isContentEditable) {
        capitalizarNoEditor(elemento);
    }
}, true);

function capitalizarNoEditor(elemento) {
    const selecao = window.getSelection();
    if (!selecao?.rangeCount || !document.queryCommandSupported('insertText')) return;

    const cursorRange = selecao.getRangeAt(0);
    const no = cursorRange.startContainer;
    const cursor = cursorRange.startOffset;
    if (no.nodeType !== Node.TEXT_NODE || cursor < 1) return;

    const caractere = no.textContent.charAt(cursor - 1);
    if (!/[a-záéíóúâêôãõàèìòùç]/i.test(caractere) || caractere === caractere.toUpperCase()) return;

    const editor = elemento.closest('[contenteditable]') || elemento;
    const antesDoCaractere = document.createRange();
    antesDoCaractere.selectNodeContents(editor);
    antesDoCaractere.setEnd(no, cursor - 1);
    const textoAnterior = antesDoCaractere.toString();
    if (textoAnterior.trim() !== '' && !/[.!?]\s+$/.test(textoAnterior)) return;

    const letra = document.createRange();
    letra.setStart(no, cursor - 1);
    letra.setEnd(no, cursor);
    selecao.removeAllRanges();
    selecao.addRange(letra);
    document.execCommand('insertText', false, caractere.toUpperCase());
}

document.addEventListener('keyup', (evento) => {
    if (evento.ctrlKey || evento.metaKey) return;
    const elemento = evento.target;
    const campoTexto = elemento instanceof HTMLInputElement && ['text', 'search'].includes(elemento.type);
    const areaTexto = elemento instanceof HTMLTextAreaElement;
    const editavel = elemento instanceof HTMLElement && elemento.isContentEditable;
    const editorAtivo = editavel ? (elemento.closest('[contenteditable]') || elemento) : elemento;
    if (!campoTexto && !areaTexto && !editavel) return;

    if ((campoTexto || areaTexto) && typeof elemento.selectionStart === 'number') {
        const textoCapitalizado = capitalizarTexto(elemento.value);
        if (textoCapitalizado !== elemento.value) {
            const cursor = elemento.selectionStart;
            elemento.value = textoCapitalizado;
            elemento.setSelectionRange(cursor, cursor);
            elemento.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                inputType: 'insertReplacementText'
            }));
        }
    } else if (editavel) {
        capitalizarNoEditor(elemento);
    }

    if (![' ', '.', ',', '!', '?', ';', 'Enter'].includes(evento.key)) return;

    if (campoTexto || areaTexto) {
        const cursor = elemento.selectionStart;
        if (cursor < 2) return;
        const texto = elemento.value;
        const ateCursor = texto.slice(0, cursor - 1);
        const palavra = ateCursor.split(/[\s\p{P}\p{S}]+/u).at(-1) || '';
        if (!palavra) return;
        const inicio = cursor - 1 - palavra.length;

        solicitarCorrecao(palavra, (corrigida) => {
            if (!elemento.isConnected || texto.slice(inicio, cursor - 1) !== palavra ||
                elemento.value.slice(inicio, cursor - 1) !== palavra) return;
            elemento.setRangeText(corrigida, inicio, cursor - 1, 'preserve');
            elemento.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                inputType: 'insertReplacementText',
                data: corrigida
            }));
        });
        return;
    }

    if (!editavel || evento.key === 'Enter' || !document.queryCommandSupported('insertText')) return;
    const selecao = window.getSelection();
    if (!selecao?.rangeCount) return;
    const cursorRange = selecao.getRangeAt(0);
    const no = cursorRange.startContainer;
    const cursor = cursorRange.startOffset;
    if (no.nodeType !== Node.TEXT_NODE || cursor < 2) return;
    const texto = no.textContent || '';
    const ateCursor = texto.slice(0, cursor - 1);
    const palavra = ateCursor.split(/[\s\p{P}\p{S}]+/u).at(-1) || '';
    if (!palavra) return;
    const inicio = cursor - 1 - palavra.length;

    solicitarCorrecao(palavra, (corrigida) => {
        const selecaoAtual = window.getSelection();
        if (!no.isConnected || document.activeElement !== editorAtivo ||
            !selecaoAtual?.rangeCount || selecaoAtual.anchorNode !== no ||
            selecaoAtual.anchorOffset !== cursor || no.textContent.slice(inicio, cursor - 1) !== palavra) return;
        const range = document.createRange();
        range.setStart(no, inicio);
        range.setEnd(no, cursor - 1);
        selecaoAtual.removeAllRanges();
        selecaoAtual.addRange(range);
        document.execCommand('insertText', false, corrigida);
    });
});

// Inicia o dicionário fora da página para que ele esteja pronto quando o usuário digitar.
prepararCorretor();
