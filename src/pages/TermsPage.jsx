import React from 'react';

const TermsPage = () => {
  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">利用規約</h1>
      
      <div className="bg-white shadow rounded-lg p-6">
        <div className="prose max-w-none">
          <h2>1. はじめに</h2>
          <p>
            本利用規約（以下「本規約」といいます）は、SafeVideo（以下「当社」といいます）が提供するサービス（以下「本サービス」といいます）の利用条件を定めるものです。
            利用者は、本規約に同意の上、本サービスをご利用いただくものとします。
          </p>
          
          <h2>2. サービス内容</h2>
          <p>
            本サービスは、コンテンツ制作者が出演者情報と身分証明書を安全に管理するためのプラットフォームです。
            利用者は本サービスを通じて、コンテンツに関する情報および出演者に関する情報を登録・管理することができます。
          </p>
          
          <h2>3. アカウント管理</h2>
          <p>
            本サービスの利用にあたり、利用者はアカウントを作成する必要があります。
            利用者は、自己の責任においてアカウント情報を管理し、第三者に漏洩することのないよう十分注意してください。
            アカウント情報の管理不備により生じた損害について、当社は一切の責任を負いません。
          </p>
          
          <h2>4. 禁止事項</h2>
          <p>利用者は、以下の行為を行ってはならないものとします。</p>
          <ul>
            <li>法令または公序良俗に違反する行為</li>
            <li>犯罪行為に関連する行為</li>
            <li>当社のサーバーやネットワークシステムに支障を与える行為</li>
            <li>当社のサービスの運営を妨害する行為</li>
            <li>他の利用者に迷惑をかける行為</li>
            <li>他者になりすます行為</li>
            <li>当社のサービスに関連して、反社会的勢力に対して直接または間接に利益を供与する行為</li>
            <li>その他、当社が不適切と判断する行為</li>
          </ul>
          
          <h2>5. サービスの変更・停止</h2>
          <p>
            当社は、事前の通知なく、本サービスの内容を変更し、または提供を停止することができるものとします。
            サービスの変更・停止によって生じた利用者の損害について、当社は一切の責任を負いません。
          </p>
          
          <h2>6. 免責事項</h2>
          <p>
            当社は、本サービスに関して、その完全性、正確性、確実性、有用性等について、いかなる保証も行いません。
            利用者が本サービスを利用することにより生じた損害について、当社は一切の責任を負いません。
          </p>
          
          <h2>7. プライバシーポリシー</h2>
          <p>
            当社のプライバシーポリシーは、本規約の一部を構成します。
            本サービスを利用する前に、プライバシーポリシーも併せてご確認ください。
          </p>
          
          <h2>8. 規約の変更</h2>
          <p>
            当社は、必要と判断した場合には、利用者に通知することなく本規約を変更することができるものとします。
            変更後の利用規約は、当社ウェブサイトに掲載された時点から効力を生じるものとします。
          </p>
          
          <h2>9. 準拠法・管轄裁判所</h2>
          <p>
            本規約の解釈にあたっては、日本法を準拠法とします。
            本サービスに関連して生じた紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
          </p>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;