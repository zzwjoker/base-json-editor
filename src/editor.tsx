import { useEffect, useRef, useState } from 'react';
import { FloatButton, message, Empty } from 'antd';
import * as monaco from 'monaco-editor';
import { bitable, FieldType, IField, Selection } from '@lark-base-open/js-sdk'
import { isObject } from 'lodash-es';
import translationZH from './locales/zh.json';
import translationEN from './locales/en.json';
import './user-worker';
import './index.css';

const useSelection = () => {
  const [field, setField] = useState<IField | null>(null);
  const [recordId, setRecordId] = useState('');
  const [cellValue, setCellValue] = useState<null | string>(null);
  const [fieldTypeNotMatch, setFieldTypeNotMatch] = useState(true);
  
  const clearSelection = () => {
    setField(null);
    setRecordId('');
    setCellValue(null);
    setFieldTypeNotMatch(true);
  }

  // 监听选区变化
  useEffect(() => {
    const onSelectionChange = async (selection: Selection) => {
      const { tableId, fieldId, recordId } = selection;
      if (tableId && fieldId && recordId) {
        const table = await bitable.base.getTableById(tableId);
        const field = await table.getFieldById(fieldId);
        const fieldType = await field.getType();
        const cellValue = await field.getCellString(recordId);
        if (fieldType === FieldType.Text) {
          setField(field);
          setRecordId(recordId);
          setCellValue(cellValue);
          setFieldTypeNotMatch(false);
        } else {
          clearSelection();
        }
      } else {
        clearSelection();
      }
    };

    bitable.base.getSelection().then(selection => {
      onSelectionChange(selection);
    });
    const off = bitable.base.onSelectionChange(event => {
      console.log('onSelectionChange', event);
      onSelectionChange(event.data);
    });

    return () => off();
  }, []);

  return {
    field,
    recordId,
    cellValue,
    fieldTypeNotMatch,
  };
};

type I18n = Record<keyof typeof translationZH, string>
const useTranslation = () => {
  const [i18n, setI18n] = useState<I18n>({} as I18n);

  useEffect(() => {
    bitable.bridge.getLanguage().then((lang) => {
      const translationMap: Record<string, I18n> = {
        zh: translationZH,
        en: translationEN,
      };
      setI18n(translationMap[lang] ?? translationEN);
    });
  }, []);

  return i18n;
};

export const Editor = () => {
	const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
	const monacoEl = useRef(null);
  const { fieldTypeNotMatch, field, recordId, cellValue } = useSelection();
  const i18n = useTranslation();

  const onFormatJson = () => {
    try {
      const jsonStr = editor?.getValue();
      const jsonObj = JSON.parse(jsonStr ?? '');
      if (!isObject(jsonObj)) {
        throw new Error('json not valid');
      }
      editor?.setValue(JSON.stringify(jsonObj, null, 2));
    } catch (e) {
      console.log('format json error ', e);
      message.error(i18n.formatJsonErrorTip)
    }
  };

  const copyJson = () => {
    const jsonStr = editor?.getValue() ?? '';
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.value = jsonStr;
    textarea.select();
    if (document.execCommand('copy')) {
      document.execCommand('copy');
      message.success(i18n.copySuccess);
    } else {
      message.error(i18n.copyFail);
    }
    textarea.remove();
  }

	useEffect(() => {
		if (monacoEl.current) {
			setEditor((editor) => {
				if (editor) return editor;

				return monaco.editor.create(monacoEl.current!, {
          language: "json",
          automaticLayout: true,
        });
			});
		}

		return () => editor?.dispose();
	}, []);

  // 设置编辑器值
  useEffect(() => {
    editor?.setValue(cellValue ?? '');
  }, [editor, cellValue]);

  // 更新record值
  useEffect(() => {
    const listener = editor?.onDidChangeModelContent(() => {
      if (field && recordId) {
        const jsonStr = editor.getValue();
        field.setValue(recordId, jsonStr);
      }
    });

    return () => listener?.dispose();
  }, [editor, field, recordId]);

	return (
    <div className="json-editor-wrapper">
      <div className="json-editor" ref={monacoEl}></div>
      <FloatButton.Group
        trigger="hover"
        type="primary"
        icon={<div className='tool-btn'></div>}
      >
        <FloatButton tooltip={<div>{i18n.copy}</div>} icon={<div className='copy-btn'></div>} onClick={() => copyJson()} />
        <FloatButton tooltip={<div>{i18n.formatJson}</div>} icon={<div className='json-format-btn'></div>} onClick={() => onFormatJson()} />
      </FloatButton.Group>
      {
        fieldTypeNotMatch && <Empty className="json-editor-tip" description={i18n.selectFieldTip}></Empty>
      }
    </div>
  );
};
